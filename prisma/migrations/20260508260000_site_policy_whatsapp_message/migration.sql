-- Pre-filled WhatsApp message body. Storefront callsites previously
-- hardcoded "Hi YNOT, I have a question." (and a return-specific
-- variant); now sourced from this column so operator edits propagate
-- everywhere on the next request.
ALTER TABLE "SitePolicy"
  ADD COLUMN "whatsappMessage" TEXT NOT NULL DEFAULT 'Hi YNOT, I have a question.';
