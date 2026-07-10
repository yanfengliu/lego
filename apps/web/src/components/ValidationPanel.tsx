import type { ValidationReportV1 } from "@lego-studio/protocol";

export function ValidationPanel({ report }: { readonly report: ValidationReportV1 }) {
  const blocking = report.issues.filter(({ severity }) => severity === "blocking");
  return (
    <section className="validation-section" aria-labelledby="validation-heading">
      <div className="validation-summary">
        <div>
          <p className="kicker">Deterministic checks</p>
          <h2 id="validation-heading">Validation</h2>
        </div>
        <span className={blocking.length === 0 ? "status-pill is-valid" : "status-pill is-invalid"}>
          {blocking.length === 0 ? "valid" : `${blocking.length} blocking`}
        </span>
      </div>
      {report.issues.length === 0 ? (
        <p className="validation-clean">
          Graph, ports, transforms, memberships, and collisions agree.
        </p>
      ) : (
        <ul className="issue-list">
          {report.issues.slice(0, 8).map((issue) => (
            <li key={issue.issueId}>
              <strong>{issue.code.replaceAll("_", " ").toLowerCase()}</strong>
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
