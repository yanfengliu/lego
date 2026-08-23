import ts from "typescript";

export function staticString(expression: ts.Expression | undefined): string | null {
  const budget = { nodes: 32, characters: 256 };
  const evaluate = (candidate: ts.Expression | undefined): string | null => {
    if (candidate === undefined || budget.nodes <= 0) return null;
    budget.nodes -= 1;
    let value: string | null = null;
    if (ts.isStringLiteral(candidate) || ts.isNoSubstitutionTemplateLiteral(candidate)) {
      value = candidate.text;
    } else if (ts.isParenthesizedExpression(candidate)) {
      value = evaluate(candidate.expression);
    } else if (
      ts.isAsExpression(candidate) ||
      ts.isTypeAssertionExpression(candidate) ||
      ts.isNonNullExpression(candidate)
    ) {
      value = evaluate(candidate.expression);
    } else if (
      ts.isBinaryExpression(candidate) &&
      candidate.operatorToken.kind === ts.SyntaxKind.PlusToken
    ) {
      const left = evaluate(candidate.left);
      const right = evaluate(candidate.right);
      if (left !== null && right !== null) value = `${left}${right}`;
    } else if (ts.isTemplateExpression(candidate)) {
      let assembled = candidate.head.text;
      for (const span of candidate.templateSpans) {
        const substitution = evaluate(span.expression);
        if (substitution === null) return null;
        assembled += substitution + span.literal.text;
        if (assembled.length > budget.characters) return null;
      }
      value = assembled;
    }
    return value !== null && value.length <= budget.characters ? value : null;
  };
  return evaluate(expression);
}
