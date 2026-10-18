import { VerifyQr } from "@/components/documents/verify-qr"
import type { PrintDocument } from "@/lib/documents/present"

export function DocumentSheet({
  document,
  signatureDrop = 0,
}: {
  document: PrintDocument
  signatureDrop?: number
}) {
  const rows = document.lines.map((line, index) => ({
    line,
    index,
    section:
      line.section && line.section !== (document.lines[index - 1]?.section ?? "")
        ? line.section
        : "",
  }))

  return (
    <article className="document-sheet">
      <div className="doc-stack">
        <header className="doc-header">
          <div>
            <p className="doc-kicker">{document.kicker}</p>
            <h1>{document.title}</h1>
          </div>
          <div className="doc-meta">
            <p>
              {document.numberLabel} {document.documentNo}
            </p>
            <p>Date {document.issuedOn}</p>
          </div>
          <VerifyQr url={document.verifyUrl} />
        </header>

        {document.parties.length > 0 ? (
          <div className={document.parties.length > 1 ? "doc-grid" : undefined}>
            {document.parties.map((party) => (
              <section key={party.heading} className="doc-card">
                <h2>{party.heading}</h2>
                <p className="doc-name">{party.name}</p>
                {party.detail ? <p className="doc-detail">{party.detail}</p> : null}
              </section>
            ))}
          </div>
        ) : null}

        {document.facts.length > 0 ? (
          <section className="doc-card">
            <h2>Details</h2>
            <dl className="doc-facts">
              {document.facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {document.intro ? <p className="doc-intro">{document.intro}</p> : null}

        {document.lines.length > 0 ? (
          <div className="min-w-0 overflow-x-auto">
            <table className="doc-table">
              <thead>
                <tr>
                  <th>S/L</th>
                  <th>Item & Specification</th>
                  <th className="num">Quantity</th>
                  <th>Unit</th>
                  <th className="num">Unit Price</th>
                  <th className="num">Total Price</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <FragmentRow
                    key={`${row.line.item}-${row.index}`}
                    section={row.section}
                    index={row.index + 1}
                    line={row.line}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="doc-split">
          <section className="doc-card">
            <h2>{document.wordsLabel}</h2>
            <p className="doc-copy">{document.words}</p>
          </section>
          <div className="doc-total">
            <dl className="doc-summary">
              {document.summary.map((row) => (
                <div key={row.label} className={row.strong ? "strong" : undefined}>
                  <dt>{row.label}</dt>
                  <dd className="num">{row.deduct ? `(${row.amount})` : row.amount}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {document.milestones.length > 0 ? (
          <section>
            <h2 className="doc-kicker">{document.milestonesTitle}</h2>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>S/L</th>
                  <th>Milestone</th>
                  <th className="num">Percentage</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {document.milestones.map((milestone, index) => (
                  <tr key={`${milestone.label}-${index}`}>
                    <td>{String(index + 1).padStart(2, "0")}</td>
                    <td>{milestone.label}</td>
                    <td className="num">{milestone.percent}</td>
                    <td className="num">{milestone.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {document.terms ? (
          <section className="doc-block">
            <h2>Terms & Conditions</h2>
            <p className="doc-copy">{document.terms}</p>
          </section>
        ) : null}

        {document.exclusions ? (
          <section className="doc-block">
            <h2>Exclusions</h2>
            <p className="doc-copy">{document.exclusions}</p>
          </section>
        ) : null}

        {document.notes ? (
          <section className="doc-block">
            <h2>Notes</h2>
            <p className="doc-copy">{document.notes}</p>
          </section>
        ) : null}

        {document.signatures.length > 0 ? (
          <section
            className="doc-signs"
            style={signatureDrop > 0 ? { marginTop: `calc(18mm + ${signatureDrop}px)` } : undefined}
          >
            {document.signatures.map((signature) => (
              <div key={signature.label} className="doc-sign">
                <p className="doc-kicker">{signature.label}</p>
                {signature.name ? <p>{signature.name}</p> : null}
                {signature.detail ? <p className="role">{signature.detail}</p> : null}
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </article>
  )
}

function FragmentRow({
  section,
  index,
  line,
}: {
  section: string
  index: number
  line: PrintDocument["lines"][number]
}) {
  return (
    <>
      {section ? (
        <tr className="doc-section">
          <td colSpan={6}>{section}</td>
        </tr>
      ) : null}
      <tr>
        <td>{String(index).padStart(2, "0")}</td>
        <td>
          {line.item}
          {line.specification ? <span className="doc-spec">{line.specification}</span> : null}
        </td>
        <td className="num">{line.quantity}</td>
        <td>{line.unit}</td>
        <td className="num">{line.unitPrice}</td>
        <td className="num">{line.total}</td>
      </tr>
    </>
  )
}
