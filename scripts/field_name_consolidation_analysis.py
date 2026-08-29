import ast
import io
import json
import symtable
import sys
import tokenize


request = json.load(sys.stdin)
source_text = request["sourceText"]
target_module = request["targetModule"]
target_field = request["targetField"]
tree = ast.parse(source_text)
symbols = symtable.symtable(source_text, "<field-name-consumer>", "exec")

parents = {}
for parent in ast.walk(tree):
    for child in ast.iter_child_nodes(parent):
        parents[child] = parent


def table_type(table):
    value = table.get_type()
    return getattr(value, "value", value)


tables_by_scope = {}
ambiguous_scope_keys = set()
relevant_ambiguous_scope_keys = set()


def register_table(table):
    kind = table_type(table)
    if kind in {"function", "class"} and table.get_name() != "__annotate__":
        key = (kind, table.get_name(), table.get_lineno())
        if key in tables_by_scope:
            ambiguous_scope_keys.add(key)
        else:
            tables_by_scope[key] = table
    for child in table.get_children():
        register_table(child)


register_table(symbols)


def ast_scope_key(node):
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        return ("function", node.name, node.lineno)
    if isinstance(node, ast.Lambda):
        return ("function", "lambda", node.lineno)
    if isinstance(node, ast.ClassDef):
        return ("class", node.name, node.lineno)
    return None


def containing_scope_node(node):
    current = parents.get(node)
    while current is not None:
        if isinstance(current, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda, ast.ClassDef)):
            return current
        current = parents.get(current)
    return tree


def table_for_node(node, track_ambiguity=False):
    scope = containing_scope_node(node)
    if scope is tree:
        return symbols
    key = ast_scope_key(scope)
    if key in ambiguous_scope_keys:
        if track_ambiguity:
            relevant_ambiguous_scope_keys.add(key)
        return None
    if key not in tables_by_scope:
        return None
    return tables_by_scope[key]


def nearest_comprehension(node):
    current = parents.get(node)
    while current is not None:
        if isinstance(current, (ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp)):
            return current
        if isinstance(current, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda, ast.ClassDef)):
            return None
        current = parents.get(current)
    return None


def descendant_of(node, ancestor):
    current = node
    while current is not None:
        if current is ancestor:
            return True
        current = parents.get(current)
    return False


def comprehension_locally_binds(node, name):
    comprehension = nearest_comprehension(node)
    if comprehension is None:
        return False
    for generator in comprehension.generators:
        for target in ast.walk(generator.target):
            if isinstance(target, ast.Name) and target.id == name:
                return True
    return False


def declared_global_store(node, name):
    table = table_for_node(node, track_ambiguity=True)
    if table is None or table is symbols:
        return False
    try:
        symbol = table.lookup(name)
    except KeyError:
        return False
    return symbol.is_declared_global()


def writes_module_binding(node, name):
    return containing_scope_node(node) is tree or declared_global_store(node, name)


def resolves_to_module_binding(node, local_name):
    if node.id != local_name or comprehension_locally_binds(node, local_name):
        return False
    table = table_for_node(node, track_ambiguity=True)
    if table is None:
        return False
    if table is symbols:
        return True
    try:
        symbol = table.lookup(local_name)
    except KeyError:
        return False
    if symbol.is_free() or symbol.is_nonlocal():
        return False
    if symbol.is_local() or symbol.is_parameter() or symbol.is_imported() or symbol.is_assigned():
        return False
    return symbol.is_global()


def resolves_to_module_import(node, local_name):
    return resolves_to_module_binding(node, local_name)


def fold_string(node):
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        left = fold_string(node.left)
        right = fold_string(node.right)
        if left is not None and right is not None:
            return left + right
    return None


def is_single_direct_string_literal(node):
    if not isinstance(node, ast.Constant) or not isinstance(node.value, str):
        return False
    segment = ast.get_source_segment(source_text, node)
    if segment is None:
        return False
    try:
        string_tokens = [
            token
            for token in tokenize.generate_tokens(io.StringIO(segment).readline)
            if token.type == tokenize.STRING
        ]
    except (IndentationError, SyntaxError, tokenize.TokenError):
        return False
    return len(string_tokens) == 1


def helper_binding_is_stable(name):
    definitions = [
        statement
        for statement in tree.body
        if isinstance(statement, (ast.FunctionDef, ast.AsyncFunctionDef)) and statement.name == name
    ]
    if len(definitions) != 1:
        return False
    definition = definitions[0]
    for node in ast.walk(tree):
        if node is definition:
            continue
        if isinstance(node, ast.Name) and isinstance(node.ctx, (ast.Store, ast.Del)) and node.id == name:
            comprehension = nearest_comprehension(node)
            if comprehension is not None and not isinstance(parents.get(node), ast.NamedExpr):
                continue
            if writes_module_binding(node, name):
                return False
        if (
            isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))
            and node.name == name
            and writes_module_binding(node, name)
        ):
            return False
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            for alias in node.names:
                bound = alias.asname or (
                    alias.name.split(".", 1)[0] if isinstance(node, ast.Import) else alias.name
                )
                if bound == name and writes_module_binding(node, name):
                    return False
        if (
            isinstance(node, ast.ExceptHandler)
            and node.name == name
            and writes_module_binding(node, name)
        ):
            return False
        if (
            isinstance(node, (ast.MatchAs, ast.MatchStar))
            and node.name == name
            and writes_module_binding(node, name)
        ):
            return False
        if (
            isinstance(node, ast.MatchMapping)
            and node.rest == name
            and writes_module_binding(node, name)
        ):
            return False
    return True


def calls_module_function(node, name):
    return (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and helper_binding_is_stable(name)
        and resolves_to_module_binding(node.func, name)
    )


def nearest_function(node):
    current = parents.get(node)
    while current is not None:
        if isinstance(current, (ast.FunctionDef, ast.AsyncFunctionDef)):
            return current
        if isinstance(current, ast.Lambda):
            return None
        current = parents.get(current)
    return None


def nearest_statement(node):
    current = node
    while current is not None:
        if isinstance(current, ast.stmt):
            return current
        current = parents.get(current)
    return None


FALLTHROUGH = "fallthrough"
NORMAL_RETURN = "return"
RAISE = "raise"
BREAK = "break"
CONTINUE = "continue"
UNKNOWN = "unknown"
UNKNOWN_VALUE = object()


def constant_scalar(node):
    if isinstance(node, ast.Constant) and isinstance(
        node.value, (bool, int, float, str, bytes, type(None))
    ):
        return node.value
    if isinstance(node, ast.UnaryOp):
        value = constant_scalar(node.operand)
        if value is UNKNOWN_VALUE:
            return UNKNOWN_VALUE
        if isinstance(node.op, ast.Not):
            return not value
        if isinstance(node.op, ast.UAdd):
            return +value
        if isinstance(node.op, ast.USub):
            return -value
    if isinstance(node, ast.BoolOp):
        values = [constant_truth(value) for value in node.values]
        if isinstance(node.op, ast.And):
            if False in values:
                return False
            return True if all(value is True for value in values) else UNKNOWN_VALUE
        if True in values:
            return True
        return False if all(value is False for value in values) else UNKNOWN_VALUE
    if isinstance(node, ast.Compare) and len(node.ops) == 1 and len(node.comparators) == 1:
        left = constant_scalar(node.left)
        right = constant_scalar(node.comparators[0])
        if left is UNKNOWN_VALUE or right is UNKNOWN_VALUE:
            return UNKNOWN_VALUE
        if isinstance(node.ops[0], (ast.Eq, ast.Is)):
            return left == right
        if isinstance(node.ops[0], (ast.NotEq, ast.IsNot)):
            return left != right
    return UNKNOWN_VALUE


def constant_truth(node):
    value = constant_scalar(node)
    return UNKNOWN_VALUE if value is UNKNOWN_VALUE else bool(value)


def summarize_sequence(statements):
    outcomes = {FALLTHROUGH}
    for statement in statements:
        if FALLTHROUGH not in outcomes:
            break
        outcomes.remove(FALLTHROUGH)
        outcomes.update(summarize_statement(statement))
    return outcomes


def apply_finally(outcomes, finalbody):
    if not finalbody:
        return outcomes
    final_outcomes = summarize_sequence(finalbody)
    result = final_outcomes - {FALLTHROUGH}
    if FALLTHROUGH in final_outcomes:
        result.update(outcomes)
    return result


def summarize_statement(node):
    if isinstance(node, ast.Return):
        return {NORMAL_RETURN}
    if isinstance(node, ast.Raise):
        return {RAISE}
    if isinstance(node, ast.Break):
        return {BREAK}
    if isinstance(node, ast.Continue):
        return {CONTINUE}
    if isinstance(node, ast.If):
        condition = constant_truth(node.test)
        when_true = summarize_sequence(node.body)
        when_false = summarize_sequence(node.orelse) if node.orelse else {FALLTHROUGH}
        if condition is True:
            return when_true
        if condition is False:
            return when_false
        return when_true | when_false
    if isinstance(node, (ast.For, ast.AsyncFor)):
        body = summarize_sequence(node.body)
        return {FALLTHROUGH} | (body & {NORMAL_RETURN, RAISE, UNKNOWN})
    if isinstance(node, ast.While):
        condition = constant_truth(node.test)
        if condition is False:
            return {FALLTHROUGH}
        body = summarize_sequence(node.body)
        outcomes = body & {NORMAL_RETURN, RAISE, UNKNOWN}
        if condition is UNKNOWN_VALUE or BREAK in body:
            outcomes.add(FALLTHROUGH)
        return outcomes or {UNKNOWN}
    if isinstance(node, ast.Try):
        attempted = summarize_sequence(node.body)
        outcomes = attempted - {RAISE, FALLTHROUGH}
        if FALLTHROUGH in attempted:
            outcomes.update(summarize_sequence(node.orelse))
        if node.handlers:
            for handler in node.handlers:
                outcomes.update(summarize_sequence(handler.body))
        else:
            outcomes.add(RAISE)
        return apply_finally(outcomes, node.finalbody)
    if isinstance(node, (ast.Match, ast.With, ast.AsyncWith)):
        return {UNKNOWN}
    return {FALLTHROUGH}


def prefix_admits(statements, target):
    if target not in statements:
        return False
    outcomes = summarize_sequence(statements[: statements.index(target)])
    return FALLTHROUGH in outcomes and not outcomes.intersection(
        {NORMAL_RETURN, BREAK, CONTINUE, UNKNOWN}
    )


def direct_live_statement(node, function_name):
    function = nearest_function(node)
    statement = nearest_statement(node)
    if function is None or function.name != function_name or statement not in function.body:
        return False
    if not prefix_admits(function.body, statement):
        return False
    current = node
    while current is not statement:
        if isinstance(
            current,
            (
                ast.BoolOp,
                ast.IfExp,
                ast.Lambda,
                ast.ListComp,
                ast.SetComp,
                ast.DictComp,
                ast.GeneratorExp,
            ),
        ):
            return False
        current = parents.get(current)
        if current is None:
            return False
    return True


def assigned_dict_name(dictionary):
    parent = parents.get(dictionary)
    if isinstance(parent, ast.Assign) and len(parent.targets) == 1 and isinstance(parent.targets[0], ast.Name):
        return parent.targets[0].id
    if isinstance(parent, ast.AnnAssign) and isinstance(parent.target, ast.Name):
        return parent.target.id
    return None


def exact_bindings_loop(loop):
    if not isinstance(loop, ast.For) or loop.orelse:
        return False
    iterator = loop.iter
    if not (
        isinstance(iterator, ast.Call)
        and not iterator.args
        and not iterator.keywords
        and isinstance(iterator.func, ast.Attribute)
        and iterator.func.attr == "items"
        and isinstance(iterator.func.value, ast.Name)
        and iterator.func.value.id == "bindings"
    ):
        return False
    target = loop.target
    if not (
        isinstance(target, (ast.Tuple, ast.List))
        and len(target.elts) == 2
        and isinstance(target.elts[0], ast.Name)
        and target.elts[0].id == "field"
        and isinstance(target.elts[1], (ast.Tuple, ast.List))
        and len(target.elts[1].elts) == 2
        and all(isinstance(item, ast.Name) for item in target.elts[1].elts)
        and [item.id for item in target.elts[1].elts] == ["declared", "actual"]
    ):
        return False
    body_outcomes = summarize_sequence(loop.body)
    if FALLTHROUGH not in body_outcomes or body_outcomes.intersection(
        {NORMAL_RETURN, BREAK, CONTINUE, UNKNOWN}
    ):
        return False
    digested = []
    mismatch_raises = 0
    for statement in loop.body:
        statement_is_live = prefix_admits(loop.body, statement)
        if statement_is_live and isinstance(statement, ast.Expr) and isinstance(statement.value, ast.Call):
            call = statement.value
            if (
                calls_module_function(call, "_digest")
                and call.args
                and isinstance(call.args[0], ast.Name)
                and call.args[0].id in {"declared", "actual"}
            ):
                digested.append(call.args[0].id)
        if not statement_is_live or not isinstance(statement, ast.If) or statement.orelse:
            continue
        comparison = statement.test
        if (
            isinstance(comparison, ast.Compare)
            and isinstance(comparison.left, ast.Name)
            and comparison.left.id == "declared"
            and len(comparison.ops) == 1
            and isinstance(comparison.ops[0], ast.NotEq)
            and len(comparison.comparators) == 1
            and isinstance(comparison.comparators[0], ast.Name)
            and comparison.comparators[0].id == "actual"
            and summarize_sequence(statement.body) == {RAISE}
        ):
            mismatch_raises += 1
    return digested == ["declared", "actual"] and mismatch_raises == 1


def exact_bindings_consumer(dictionary):
    assignment = parents.get(dictionary)
    function = nearest_function(dictionary)
    if (
        function is None
        or function.name != "require_action_ledger_report_chain"
        or not isinstance(assignment, (ast.Assign, ast.AnnAssign))
        or not direct_live_statement(dictionary, function.name)
    ):
        return False
    targets = assignment.targets if isinstance(assignment, ast.Assign) else [assignment.target]
    if len(targets) != 1 or not isinstance(targets[0], ast.Name) or targets[0].id != "bindings":
        return False
    stores = []
    loads = []
    for node in ast.walk(function):
        if nearest_function(node) is not function:
            continue
        if isinstance(node, ast.Name) and node.id == "bindings":
            if isinstance(node.ctx, (ast.Store, ast.Del)):
                stores.append(node)
            elif isinstance(node.ctx, ast.Load):
                loads.append(node)
    loops = [
        statement
        for statement in function.body
        if exact_bindings_loop(statement) and direct_live_statement(statement, function.name)
    ]
    return (
        stores == [targets[0]]
        and len(loads) == 1
        and len(loops) == 1
        and function.body.index(loops[0]) > function.body.index(assignment)
        and descendant_of(loads[0], loops[0].iter)
    )


def production_path(node, local_name):
    parent = parents.get(node)
    if isinstance(parent, ast.Set) and node in parent.elts:
        call = parents.get(parent)
        if (
            isinstance(call, ast.Call)
            and len(call.args) > 1
            and call.args[1] is parent
            and calls_module_function(call, "_exact_fields")
            and direct_live_statement(call, "require_action_ledger_report_chain")
        ):
            return "action-ledger-exact-fields-set-key"
    if isinstance(parent, ast.Dict) and node in parent.keys:
        if (
            assigned_dict_name(parent) == "bindings"
            and direct_live_statement(parent, "require_action_ledger_report_chain")
            and exact_bindings_consumer(parent)
        ):
            return "action-ledger-bindings-dict-key"
    if isinstance(parent, ast.Subscript) and parent.slice is node:
        current = parents.get(parent)
        while current is not None and not isinstance(current, ast.Dict):
            current = parents.get(current)
        if (
            isinstance(current, ast.Dict)
            and assigned_dict_name(current) == "bindings"
            and direct_live_statement(current, "require_action_ledger_report_chain")
            and exact_bindings_consumer(current)
        ):
            for index, value in enumerate(current.values):
                if descendant_of(parent, value):
                    key = current.keys[index]
                    if isinstance(key, ast.Name) and key.id == local_name:
                        return "action-ledger-bindings-value-subscript-key"
    if isinstance(parent, ast.Tuple) and node in parent.elts:
        outer = parents.get(parent)
        loop = parents.get(outer)
        if (
            isinstance(outer, (ast.Tuple, ast.List))
            and isinstance(loop, (ast.For, ast.AsyncFor))
            and loop.iter is outer
            and parent.elts.index(node) == 1
            and direct_live_statement(loop, "test_every_consumed_digest_edge_is_required")
        ):
            return "action-ledger-digest-edge-loop-tuple"
    return None


literal_texts = []
imports = []
loaded_names = []
direct_assignments = []
wire_uses = []
canonical_imports = []
owner_imports = []
for node in ast.walk(tree):
    folded = fold_string(node)
    if folded is not None:
        literal_texts.append(folded)
    if isinstance(node, ast.ImportFrom):
        for alias in node.names:
            item = {
                "module": node.module,
                "name": alias.name,
                "asname": alias.asname,
                "line": node.lineno,
                "column": node.col_offset,
                "scope": "module" if containing_scope_node(node) is tree else "nested",
            }
            imports.append(item)
            if item["module"] == target_module and item["scope"] == "module":
                owner_imports.append(item)
                if item["name"] == target_field:
                    canonical_imports.append(item)
    if isinstance(node, ast.Import):
        for alias in node.names:
            item = {
                "module": alias.name,
                "name": None,
                "asname": alias.asname,
                "line": node.lineno,
                "column": node.col_offset,
                "scope": "module" if containing_scope_node(node) is tree else "nested",
            }
            imports.append(item)
            if item["module"] == target_module and item["scope"] == "module":
                owner_imports.append(item)
    if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load):
        loaded_names.append(node.id)
    if isinstance(node, (ast.Assign, ast.AnnAssign)):
        value = node.value
        targets = node.targets if isinstance(node, ast.Assign) else [node.target]
        for target in targets:
            if isinstance(target, ast.Name):
                direct_assignments.append(
                    {
                        "name": target.id,
                        "directString": is_single_direct_string_literal(value),
                        "value": value.value if isinstance(value, ast.Constant) and isinstance(value.value, str) else None,
                    }
                )

canonical_import = canonical_imports[0] if len(canonical_imports) == 1 else None
canonical_local_name = None if canonical_import is None else (canonical_import["asname"] or canonical_import["name"])
canonical_references = []
if canonical_local_name is not None:
    for node in ast.walk(tree):
        if not isinstance(node, ast.Name) or not isinstance(node.ctx, ast.Load) or node.id != canonical_local_name:
            continue
        parent = parents.get(node)
        kind = None
        details = {}
        if isinstance(parent, ast.Set) and node in parent.elts:
            kind = "set-element"
        elif isinstance(parent, ast.Dict) and node in parent.keys:
            kind = "dict-key"
        elif isinstance(parent, ast.Subscript) and parent.slice is node:
            kind = "subscript-key"
        elif isinstance(parent, ast.Tuple) and node in parent.elts:
            kind = "tuple-element"
            details["index"] = parent.elts.index(node)
            details["stringPeer"] = next(
                (
                    element.value
                    for element in parent.elts
                    if isinstance(element, ast.Constant) and isinstance(element.value, str)
                ),
                None,
            )
        elif isinstance(parent, ast.List) and node in parent.elts:
            kind = "list-element"
        reference = {
            "name": node.id,
            "kind": kind,
            "line": node.lineno,
            "column": node.col_offset,
            "resolvesCanonical": resolves_to_module_import(node, canonical_local_name),
            "afterImport": (node.lineno, node.col_offset)
            > (canonical_import["line"], canonical_import["column"]),
            "productionPath": production_path(node, canonical_local_name),
            **details,
        }
        canonical_references.append(reference)
        if kind is not None:
            wire_uses.append(reference)

module_rebindings = []
if canonical_local_name is not None:
    for node in ast.walk(tree):
        if isinstance(node, ast.Name) and isinstance(node.ctx, (ast.Store, ast.Del)) and node.id == canonical_local_name:
            comprehension = nearest_comprehension(node)
            named_expression_target = isinstance(parents.get(node), ast.NamedExpr)
            if comprehension is not None and not named_expression_target:
                continue
            if writes_module_binding(node, canonical_local_name):
                module_rebindings.append(
                    {"kind": type(node.ctx).__name__, "line": node.lineno, "column": node.col_offset}
                )
        elif (
            isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))
            and node.name == canonical_local_name
            and writes_module_binding(node, canonical_local_name)
        ):
            module_rebindings.append(
                {"kind": type(node).__name__, "line": node.lineno, "column": node.col_offset}
            )
        elif isinstance(node, (ast.Import, ast.ImportFrom)):
            for alias in node.names:
                bound = alias.asname or (alias.name.split(".", 1)[0] if isinstance(node, ast.Import) else alias.name)
                is_canonical = (
                    isinstance(node, ast.ImportFrom)
                    and node.module == target_module
                    and alias.name == target_field
                    and node.lineno == canonical_import["line"]
                    and node.col_offset == canonical_import["column"]
                )
                if (
                    bound == canonical_local_name
                    and writes_module_binding(node, canonical_local_name)
                    and not is_canonical
                ):
                    module_rebindings.append(
                        {"kind": type(node).__name__, "line": node.lineno, "column": node.col_offset}
                    )
                if isinstance(node, ast.ImportFrom) and alias.name == "*":
                    module_rebindings.append(
                        {"kind": "ImportStar", "line": node.lineno, "column": node.col_offset}
                    )
        elif (
            isinstance(node, ast.ExceptHandler)
            and node.name == canonical_local_name
            and writes_module_binding(node, canonical_local_name)
        ):
            module_rebindings.append(
                {"kind": "ExceptHandler", "line": node.lineno, "column": node.col_offset}
            )
        elif (
            isinstance(node, (ast.MatchAs, ast.MatchStar))
            and node.name == canonical_local_name
            and writes_module_binding(node, canonical_local_name)
        ):
            module_rebindings.append(
                {"kind": type(node).__name__, "line": node.lineno, "column": node.col_offset}
            )
        elif (
            isinstance(node, ast.MatchMapping)
            and node.rest == canonical_local_name
            and writes_module_binding(node, canonical_local_name)
        ):
            module_rebindings.append(
                {"kind": "MatchMapping", "line": node.lineno, "column": node.col_offset}
            )

print(
    json.dumps(
        {
            "literalTexts": literal_texts,
            "imports": imports,
            "loadedNames": loaded_names,
            "directAssignments": direct_assignments,
            "wireUses": wire_uses,
            "canonicalReferences": canonical_references,
            "canonicalImports": canonical_imports,
            "ownerImports": owner_imports,
            "moduleRebindings": module_rebindings,
            "ambiguousScopes": [list(key) for key in sorted(relevant_ambiguous_scope_keys)],
        }
    )
)
