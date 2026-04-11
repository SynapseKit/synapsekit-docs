---
sidebar_position: 6
title: "Email Triage Agent"
description: "Classify, prioritise, and draft responses to incoming emails automatically using SynapseKit and Pydantic structured output."
---

import ColabBadge from '@site/src/components/ColabBadge';

# Email Triage Agent

<ColabBadge path="integrations/email-triage.ipynb" />

Support inboxes and shared email aliases fill up fast. An email triage agent can read each incoming message, classify its intent, score its urgency, route it to the right team, and draft a first-pass response — all before a human needs to touch it. This guide builds that pipeline using SynapseKit's structured output and async processing.

**What you'll build:** An async email triage pipeline that classifies intent, scores priority, assigns a routing label, and generates a draft reply for each email. **Time:** ~20 min. **Difficulty:** Intermediate

## Prerequisites

```bash
pip install synapsekit[openai] pydantic
export OPENAI_API_KEY=sk-...
```

## What you'll learn

- Model email triage decisions as Pydantic schemas
- Classify intent and priority in a single LLM call using structured output
- Generate contextually appropriate draft replies
- Process multiple emails concurrently with `asyncio.gather`
- Integrate with IMAP to fetch real emails

## Step 1: Define the triage schema

```python
import asyncio
from pydantic import BaseModel, Field
from typing import Literal, Optional
from synapsekit import LLMConfig
from synapsekit.llms.openai import OpenAILLM

class EmailTriage(BaseModel):
    intent: Literal[
        "billing_question",
        "technical_support",
        "feature_request",
        "complaint",
        "general_enquiry",
        "spam",
        "other",
    ] = Field(description="The primary intent of the email")

    priority: Literal["urgent", "high", "normal", "low"] = Field(
        description=(
            "urgent = legal/security/outage, high = unhappy paying customer, "
            "normal = general support, low = feedback/feature request"
        )
    )

    priority_score: float = Field(
        ge=0.0, le=1.0,
        description="Numeric priority score. 1.0 = most urgent."
    )

    route_to: Literal["billing", "engineering", "sales", "support", "spam_filter"] = Field(
        description="Which team should handle this email"
    )

    sentiment: Literal["positive", "negative", "neutral"]

    summary: str = Field(
        description="One-sentence summary of what the customer is asking or reporting"
    )

    requires_human: bool = Field(
        description="True if this email must be handled by a human (legal threats, refunds > $500, etc.)"
    )

    suggested_labels: list[str] = Field(
        default_factory=list,
        description="Up to 3 Gmail/Outlook label names to apply"
    )
```

## Step 2: Classify an email

```python
llm = OpenAILLM(
    model="gpt-4o-mini",
    config=LLMConfig(temperature=0.1, json_mode=True),
)

CLASSIFY_PROMPT = """You are an expert email triage assistant for a SaaS company.
Analyse the email below and classify it according to the schema.

Be conservative with 'urgent' — reserve it for legal threats, security incidents,
and production outages. Mark requires_human=True for any refund request over $500,
any legal mention, or any credible threat to escalate publicly."""

async def classify_email(subject: str, body: str, sender: str) -> EmailTriage:
    """Classify a single email and return a structured triage decision."""

    email_text = f"From: {sender}\nSubject: {subject}\n\n{body}"

    triage: EmailTriage = await llm.agenerate(
        email_text,
        system_prompt=CLASSIFY_PROMPT,
        response_model=EmailTriage,
    )
    return triage
```

## Step 3: Generate a draft reply

```python
class DraftReply(BaseModel):
    subject: str = Field(description="Reply subject line (include 'Re:' prefix)")
    body: str = Field(description="Full reply body, professional but warm in tone")
    tone: Literal["formal", "friendly", "apologetic", "informational"]
    should_send_automatically: bool = Field(
        description="True only for simple FAQ-style questions with a clear, safe answer"
    )

DRAFT_PROMPT = """You are a customer support specialist writing a reply to a customer email.
Write a helpful, professional reply. If you don't know the specific answer, acknowledge
the issue and promise follow-up. Never make up product details or pricing.
Keep replies concise — under 150 words unless the question requires detail."""

async def draft_reply(
    original_subject: str,
    original_body: str,
    triage: EmailTriage,
) -> DraftReply:
    """Generate a draft reply informed by the triage classification."""

    context = (
        f"Email intent: {triage.intent}\n"
        f"Customer sentiment: {triage.sentiment}\n"
        f"Summary: {triage.summary}\n\n"
        f"Original email:\nSubject: {original_subject}\n{original_body}"
    )

    draft: DraftReply = await llm.agenerate(
        context,
        system_prompt=DRAFT_PROMPT,
        response_model=DraftReply,
    )
    return draft
```

## Step 4: Process a batch concurrently

```python
async def triage_batch(emails: list[dict]) -> list[dict]:
    """Classify and draft replies for multiple emails concurrently.

    Running in parallel rather than sequentially reduces total wall-clock time
    roughly proportional to the number of emails (up to API rate limits).
    """
    async def process_one(email: dict) -> dict:
        triage = await classify_email(
            subject=email["subject"],
            body=email["body"],
            sender=email["from"],
        )
        draft = await draft_reply(email["subject"], email["body"], triage)
        return {
            "email":  email,
            "triage": triage,
            "draft":  draft,
        }

    results = await asyncio.gather(*[process_one(e) for e in emails])
    return list(results)
```

## Complete working example

```python
import asyncio
from pydantic import BaseModel, Field
from typing import Literal, Optional
from synapsekit import LLMConfig
from synapsekit.llms.openai import OpenAILLM

class EmailTriage(BaseModel):
    intent: Literal["billing_question","technical_support","feature_request",
                    "complaint","general_enquiry","spam","other"]
    priority: Literal["urgent","high","normal","low"]
    priority_score: float
    route_to: Literal["billing","engineering","sales","support","spam_filter"]
    sentiment: Literal["positive","negative","neutral"]
    summary: str
    requires_human: bool

class DraftReply(BaseModel):
    subject: str
    body: str
    should_send_automatically: bool

async def main():
    llm = OpenAILLM(
        model="gpt-4o-mini",
        config=LLMConfig(temperature=0.1, json_mode=True),
    )

    emails = [
        {
            "from": "angry.customer@example.com",
            "subject": "Your service is DOWN and I'm losing money",
            "body": (
                "Your API has been returning 503 errors for the past 2 hours. "
                "We're a paying Pro subscriber and this is completely unacceptable. "
                "I need someone to call me immediately. This is a production emergency."
            ),
        },
        {
            "from": "new.user@example.com",
            "subject": "How do I export my data?",
            "body": "Hi, I'm a new user. Can you explain how to export my project data as CSV?",
        },
        {
            "from": "promo@spammystore.net",
            "subject": "AMAZING DEALS — 90% off everything!!!",
            "body": "Click here to claim your prize. Limited time offer.",
        },
    ]

    print("=== Email Triage Agent ===\n")
    for email in emails:
        triage: EmailTriage = await llm.agenerate(
            f"From: {email['from']}\nSubject: {email['subject']}\n\n{email['body']}",
            response_model=EmailTriage,
        )
        draft: DraftReply = await llm.agenerate(
            f"Intent: {triage.intent}\nSummary: {triage.summary}\n\n"
            f"Original: {email['subject']}\n{email['body']}",
            response_model=DraftReply,
        )

        print(f"From:     {email['from']}")
        print(f"Subject:  {email['subject'][:60]}")
        print(f"Intent:   {triage.intent}  |  Priority: {triage.priority} ({triage.priority_score:.2f})")
        print(f"Route to: {triage.route_to}  |  Human required: {triage.requires_human}")
        print(f"Summary:  {triage.summary}")
        print(f"\nDraft reply:")
        print(f"  Subject: {draft.subject}")
        print(f"  {draft.body[:200]}...")
        print(f"  Auto-send: {draft.should_send_automatically}")
        print("-" * 60 + "\n")

asyncio.run(main())
```

## Expected output

```
=== Email Triage Agent ===

From:     angry.customer@example.com
Subject:  Your service is DOWN and I'm losing money
Intent:   technical_support  |  Priority: urgent (0.95)
Route to: engineering  |  Human required: True
Summary:  Pro subscriber reporting 2-hour API outage causing production losses, demanding immediate callback.

Draft reply:
  Subject: Re: Your service is DOWN and I'm losing money
  Hi, I sincerely apologise for the disruption you're experiencing. I've escalated
  this to our engineering team as a P1 incident. A senior engineer will contact you
  within 15 minutes. We take SLA violations seriously and will provide a full...
  Auto-send: False

------------------------------------------------------------

From:     new.user@example.com
Subject:  How do I export my data?
Intent:   general_enquiry  |  Priority: normal (0.30)
Route to: support  |  Human required: False
Summary:  New user asking how to export project data as CSV.

Draft reply:
  Subject: Re: How do I export my data?
  Hi! Great question — you can export your data as CSV from Settings → Data →
  Export. Select your project and click "Download CSV". The export is ready
  instantly. Let me know if you have any other questions!
  Auto-send: True

------------------------------------------------------------

From:     promo@spammystore.net
Subject:  AMAZING DEALS — 90% off everything!!!
Intent:   spam  |  Priority: low (0.02)
Route to: spam_filter  |  Human required: False
Summary:  Unsolicited promotional email with clickbait subject line.

Draft reply:
  Subject: Re: AMAZING DEALS — 90% off everything!!!
  (No reply recommended — spam)
  Auto-send: False
```

## How it works

Both the triage and draft steps run through the same `agenerate()` call with `response_model` set. The LLM reads the email, reasons about intent and urgency, and outputs a JSON object that Pydantic validates into a typed Python instance. Using a single LLM call for triage (rather than separate calls for classification, priority scoring, and routing) keeps latency low and cost minimal — typically under $0.001 per email with `gpt-4o-mini`.

The `requires_human` flag gives a safe escalation path: your application code can check this field and page an on-call agent rather than relying on the LLM to make the call autonomously.

## Variations

**Fetch real emails with IMAP:**
```python
import imaplib, email as email_lib

def fetch_unread_emails(host: str, user: str, password: str) -> list[dict]:
    with imaplib.IMAP4_SSL(host) as imap:
        imap.login(user, password)
        imap.select("INBOX")
        _, message_ids = imap.search(None, "UNSEEN")
        emails = []
        for mid in message_ids[0].split():
            _, data = imap.fetch(mid, "(RFC822)")
            msg = email_lib.message_from_bytes(data[0][1])
            emails.append({
                "from": msg["From"],
                "subject": msg["Subject"],
                "body": msg.get_payload(decode=True).decode("utf-8", errors="ignore"),
            })
        return emails
```

**Apply Gmail labels automatically:**
```python
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

def apply_label(service, message_id: str, label_name: str):
    label_id = get_or_create_label(service, label_name)
    service.users().messages().modify(
        userId="me",
        id=message_id,
        body={"addLabelIds": [label_id]},
    ).execute()
```

## Troubleshooting

**Spam is classified as `general_enquiry`**
Add explicit spam signals to the `CLASSIFY_PROMPT`: "If the email contains words like 'claim your prize', 'click here', or is from a no-reply promotional address, classify it as spam."

**Draft replies are too long**
Add a word limit to the draft prompt: "Keep replies under 100 words unless the question genuinely requires more detail."

**`requires_human` is always False**
This field depends on the LLM inferring intent from your business rules. Make the rules explicit in the prompt: "Set requires_human=True if the word 'legal', 'lawyer', or 'lawsuit' appears in the email."

## Next steps

- [Slack Q&A Bot](./slack-qa-bot) — notify the appropriate Slack channel when `requires_human=True`
- [Structured Output with Pydantic](../llms/structured-output-pydantic) — deeper dive into response schemas
- [Cost-Aware LLM Router](../llms/cost-router) — use GPT-4o only for urgent/complex emails
