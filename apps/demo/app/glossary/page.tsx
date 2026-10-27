"use client";

import { GlossaryProvider, GlossaryAppendix, Term } from "@sphynx/stepwise";

const ENTRIES = [
  {
    id: "http",
    term: "HTTP",
    definition: (
      <>
        HyperText Transfer Protocol — the request/response protocol behind the web.{" "}
        <Term id="https">HTTPS</Term> is the TLS-encrypted variant.
      </>
    ),
  },
  {
    id: "https",
    term: "HTTPS",
    definition: (
      <>
        HTTP over TLS. The handshake negotiates a symmetric key, then all traffic is encrypted.{" "}
        Requires a certificate from a <Term id="ca">certificate authority</Term>.
      </>
    ),
  },
  {
    id: "ca",
    term: "Certificate Authority",
    definition: (
      <>
        A trusted third party that signs <Term id="https">TLS</Term> certificates, vouching that a
        public key belongs to a specific domain. Let&apos;s Encrypt issues them for free.
      </>
    ),
  },
  {
    id: "dns",
    term: "DNS",
    definition: (
      <>
        Domain Name System — translates domain names to IP addresses. A{" "}
        <Term id="cdn">CDN</Term> uses DNS to route users to the nearest edge server.
      </>
    ),
  },
  {
    id: "cdn",
    term: "CDN",
    definition: (
      <>
        Content Delivery Network — geographically distributed servers that cache{" "}
        <Term id="http">HTTP</Term> responses near the user. Reduces latency by serving from the{" "}
        <Term id="dns">nearest</Term> edge.
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
          <h1 className="text-2xl font-bold mb-6">How the web works</h1>
          <div className="space-y-4 text-[13px] font-mono text-foreground/65 leading-relaxed">
            <p>
              When you type a URL, the first step is a <Term id="dns">DNS</Term> lookup to resolve the
              domain to an IP address. The browser then sends an <Term id="http">HTTP</Term> request
              to that address — over <Term id="https">HTTPS</Term> if the site supports it.
            </p>
            <p>
              The response often comes from a <Term id="cdn">CDN</Term> edge server rather than the
              origin. The CDN caches static assets near the user, reducing latency. Dynamic content
              still requires a trip to the origin.
            </p>
            <p>
              The <Term id="https">TLS</Term> handshake happens before any HTTP traffic: the client
              verifies the server&apos;s certificate (issued by a <Term id="ca">CA</Term>) and
              negotiates a symmetric cipher.
            </p>
          </div>
          <GlossaryAppendix entries={ENTRIES} columns={1} />
        </div>
      </main>
    </GlossaryProvider>
  );
}
