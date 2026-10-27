"use client";

import { GlossaryProvider, GlossaryAppendix, Term } from "@sphynx/stepwise";

const ENTRIES = [
  {
    id: "http",
    term: "HTTP",
    definition: (
      <>
        HyperText Transfer Protocol — the request/response protocol behind the web.{" "}
        <Term id="https">HTTPS</Term> is the TLS-encrypted variant. Every web page
        you visit starts with an <Term id="dns">HTTP</Term> request after a{" "}
        <Term id="dns">DNS</Term> lookup.
      </>
    ),
  },
  {
    id: "https",
    term: "HTTPS",
    definition: (
      <>
        HTTP over <Term id="tls">TLS</Term>. The handshake negotiates a symmetric
        key, then all traffic is encrypted. Requires a certificate from a{" "}
        <Term id="ca">certificate authority</Term>.
      </>
    ),
  },
  {
    id: "tls",
    term: "TLS",
    definition: (
      <>
        Transport Layer Security — the cryptographic protocol that secures{" "}
        <Term id="https">HTTPS</Term> connections. Replaced the deprecated SSL.
        The handshake involves a <Term id="ca">certificate</Term> exchange and a
        key negotiation.
      </>
    ),
  },
  {
    id: "ca",
    term: "Certificate Authority",
    definition: (
      <>
        A trusted third party that signs <Term id="tls">TLS</Term> certificates,
        vouching that a public key belongs to a specific domain.{" "}
        Let&apos;s Encrypt issues them for free via automated{" "}
        <Term id="dns">DNS</Term> or HTTP challenges.
      </>
    ),
  },
  {
    id: "dns",
    term: "DNS",
    definition: (
      <>
        Domain Name System — translates domain names to IP addresses. A{" "}
        <Term id="cdn">CDN</Term> uses DNS to route users to the nearest edge
        server. The lookup happens before any <Term id="http">HTTP</Term>{" "}
        traffic.
      </>
    ),
  },
  {
    id: "cdn",
    term: "CDN",
    definition: (
      <>
        Content Delivery Network — geographically distributed servers that cache{" "}
        <Term id="http">HTTP</Term> responses near the user. Reduces latency by
        serving from the <Term id="dns">nearest</Term> edge rather than the
        origin.
      </>
    ),
  },
];

export default function GlossaryDemo() {
  return (
    <GlossaryProvider entries={ENTRIES}>
      <main className="min-h-screen bg-background text-foreground pt-20 pb-16">
        <div className="max-w-2xl mx-auto px-6">
          <p className="text-[11px] font-mono uppercase tracking-widest text-primary mb-2">
            Demo — Glossary Chains
          </p>
          <h1 className="text-2xl font-bold mb-4">How the web works</h1>
          <p className="text-[13px] text-foreground/60 leading-relaxed mb-4">
            Hover over any dotted term to open a tooltip. Tooltips can contain more
            dotted terms — hover those to open nested chains. The chain is
            depth-capped at 4 to prevent infinite recursion (mutual references
            like <Term id="http">HTTP</Term> ⇄ <Term id="dns">DNS</Term> terminate cleanly).
          </p>
          <p className="text-[11px] font-mono text-foreground/30 mb-8">
            Try: hover <Term id="dns">DNS</Term> → then hover <Term id="cdn">CDN</Term> inside the tooltip → then{" "}
            <Term id="http">HTTP</Term> → then <Term id="https">HTTPS</Term> → then{" "}
            <Term id="tls">TLS</Term> → then <Term id="ca">CA</Term>. That&apos;s a 5-deep chain.
          </p>

          <div className="space-y-4 text-[13px] font-mono text-foreground/65 leading-relaxed">
            <p>
              When you type a URL, the first step is a <Term id="dns">DNS</Term> lookup to
              resolve the domain to an IP address. The browser then sends an{" "}
              <Term id="http">HTTP</Term> request to that address — over{" "}
              <Term id="https">HTTPS</Term> if the site supports it.
            </p>
            <p>
              The response often comes from a <Term id="cdn">CDN</Term> edge server rather
              than the origin. The CDN caches static assets near the user, reducing
              latency. Dynamic content still requires a trip to the origin.
            </p>
            <p>
              The <Term id="tls">TLS</Term> handshake happens before any HTTP traffic: the
              client verifies the server&apos;s certificate (issued by a{" "}
              <Term id="ca">CA</Term>) and negotiates a symmetric cipher.
            </p>
            <p>
              If the certificate is invalid or expired, the browser shows a warning. If
              it&apos;s valid, the encrypted connection is established and the{" "}
              <Term id="http">HTTP</Term> request travels inside the{" "}
              <Term id="tls">TLS</Term> tunnel.
            </p>
          </div>

          <GlossaryAppendix entries={ENTRIES} columns={1} />
        </div>
      </main>
    </GlossaryProvider>
  );
}
