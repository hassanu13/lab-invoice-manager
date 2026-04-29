import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/authorize';
import { DSDLogo } from '@/components/dsd-logo';
import { formatGBP } from '@/lib/utils';

/**
 * Placeholder invoice detail screen.
 * The full confirmation screen with PDF preview + editable fields lands in
 * Week 3. For Week 2 we show enough to confirm the upload landed correctly:
 * what was extracted, the lab, and the source file.
 */
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      lab: true,
      site: true,
      lines: true,
      sourceAttachment: true,
      workflowEvents: { orderBy: { occurredAt: 'desc' } },
    },
  });
  if (!invoice) notFound();

  return (
    <div className="min-h-screen bg-cream text-slate">
      <header className="border-b border-sand bg-cream">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/dashboard">
            <DSDLogo size={160} />
          </Link>
          <Link href="/uploads" className="text-sm text-slate/70 hover:text-slate">
            ← Uploads
          </Link>
        </div>
      </header>

      <main className="container max-w-3xl py-12">
        <h1 className="mb-1 text-2xl font-medium text-slate">Invoice {invoice.invoiceNumber}</h1>
        <p className="mb-8 text-slate/60">
          {invoice.lab.name} · {invoice.site.name} · status:{' '}
          <span className="font-medium text-slate">{invoice.status}</span>
        </p>

        <section className="mb-8 rounded-lg border border-sand bg-eggshell p-6">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-slate/60">
            Headline
          </h2>
          <dl className="grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-2">
            <Row label="Invoice date">{invoice.invoiceDate.toISOString().slice(0, 10)}</Row>
            <Row label="Total">{formatGBP(invoice.totalAmountGbp.toString())}</Row>
            <Row label="Outstanding">{formatGBP(invoice.outstandingAmountGbp.toString())}</Row>
            <Row label="Source file">{invoice.sourceAttachment?.originalFilename ?? '—'}</Row>
          </dl>
        </section>

        {invoice.lines.length > 0 && (
          <section className="mb-8 rounded-lg border border-sand bg-eggshell p-6">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-slate/60">
              Lines ({invoice.lines.length})
            </h2>
            <ul className="divide-y divide-sand text-sm">
              {invoice.lines.map((l) => (
                <li key={l.id} className="flex items-center justify-between py-3">
                  <span className="text-slate">{l.notes ?? l.jobReference ?? '—'}</span>
                  <span className="font-medium text-slate">
                    {formatGBP(l.lineAmountGbp.toString())}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-sm text-slate/60">
          Full confirmation screen with PDF preview and editable fields lands in Week 3.
        </p>
      </main>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-slate/60">{label}</dt>
      <dd className="text-slate">{children}</dd>
    </>
  );
}
