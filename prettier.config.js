export default {
  printWidth: 100,
  // This machine checks out with core.autocrlf=true, and .gitattributes marks
  // -text only the files whose exact bytes are load-bearing - the pinned
  // fixtures and the generated documents - deliberately leaving ordinary source
  // to the checkout. So a source tree is CRLF in the main checkout and LF in a
  // worktree. Pinning "lf" fails the format gate on files nobody edited; "auto"
  // accepts what git produced. The deeper fix is extending .gitattributes to
  // normalise endings repo-wide, which renormalises every file and is its own
  // change.
  endOfLine: "auto",
  proseWrap: "preserve",
  trailingComma: "all",
};
