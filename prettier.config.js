export default {
  printWidth: 100,
  // This machine checks out with core.autocrlf=true and the repo carries no
  // .gitattributes, so a working tree is CRLF in the main checkout and LF in a
  // worktree. Pinning "lf" fails the format gate on files nobody edited; "auto"
  // accepts what git produced. The deeper fix is a .gitattributes that
  // normalises endings, which renormalises every file and is its own change.
  endOfLine: "auto",
  proseWrap: "preserve",
  trailingComma: "all",
};
