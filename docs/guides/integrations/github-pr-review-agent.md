---
sidebar_position: 2
title: "GitHub PR Review Agent"
description: "Build a SynapseKit agent that fetches PR diffs with GitHubTool and generates actionable code review comments."
---

import ColabBadge from '@site/src/components/ColabBadge';

# GitHub PR Review Agent

<ColabBadge path="integrations/github-pr-review-agent.ipynb" />

Code review is time-consuming. A PR review agent can catch common issues — missing error handling, style inconsistencies, potential bugs — before a human reviewer sees the PR, letting reviewers focus on architecture and logic. This guide builds an agent that fetches a PR diff from GitHub and generates structured review comments.

**What you'll build:** A `FunctionCallingAgent` equipped with `GitHubTool` that fetches a PR's diff, analyses the changes, and posts structured review comments grouped by severity. **Time:** ~25 min. **Difficulty:** Intermediate

## Prerequisites

```bash
pip install synapsekit[openai,github]
export OPENAI_API_KEY=sk-...
export GITHUB_TOKEN=ghp_...   # Fine-grained PAT with repo read + PR write permissions
```

## What you'll learn

- Configure `GitHubTool` with a personal access token
- Build a `FunctionCallingAgent` that can list PR files, fetch diffs, and post comments
- Structure review output with Pydantic for consistent, parseable feedback
- Post inline review comments on specific file lines via the GitHub API

## Step 1: Configure GitHubTool

```python
import asyncio
from synapsekit import LLMConfig
from synapsekit.llms.openai import OpenAILLM
from synapsekit.agents import FunctionCallingAgent
from synapsekit.tools import GitHubTool

# GitHubTool wraps PyGitHub and exposes methods the agent can invoke:
# get_pr_diff, list_pr_files, post_review_comment, get_pr_metadata
github_tool = GitHubTool(
    token="GITHUB_TOKEN",        # Resolved from env var automatically if passed as env var name
    default_repo=None,           # Can be overridden per call — e.g. "owner/repo"
)
```

## Step 2: Define the review output schema

```python
from pydantic import BaseModel, Field
from typing import Literal

class ReviewComment(BaseModel):
    file_path: str = Field(description="Path of the file being commented on")
    line: int = Field(description="Line number in the diff where the comment applies")
    severity: Literal["critical", "warning", "suggestion", "praise"]
    category: Literal["bug", "security", "performance", "style", "test", "docs", "logic"]
    message: str = Field(description="Clear, actionable comment. Start with the problem, then suggest the fix.")

class PRReview(BaseModel):
    summary: str = Field(description="One-paragraph overall assessment of the PR")
    risk_level: Literal["high", "medium", "low"]
    comments: list[ReviewComment]
    approve: bool = Field(description="Whether to approve the PR")
```

## Step 3: Build the review agent

```python
REVIEW_SYSTEM_PROMPT = """You are a senior software engineer reviewing a GitHub pull request.
Your goal is to identify bugs, security issues, and improvements — not to nitpick style.

For each issue you find:
1. Cite the exact file and line number from the diff
2. Explain WHY it is a problem, not just WHAT it is
3. Suggest a concrete fix

Be constructive. Acknowledge good patterns you see. Mark only genuine issues as 'critical'."""

llm = OpenAILLM(
    model="gpt-4o",
    config=LLMConfig(temperature=0.1, max_tokens=4096, json_mode=True),
)

agent = FunctionCallingAgent(
    llm=llm,
    tools=[github_tool],
    system_prompt=REVIEW_SYSTEM_PROMPT,
)
```

## Step 4: Run the review

```python
async def review_pr(repo: str, pr_number: int) -> PRReview:
    """Fetch a PR and generate a structured code review."""

    # The agent decides which GitHub tool methods to call based on the task.
    # It will typically: get_pr_metadata → list_pr_files → get_pr_diff → generate review
    user_message = (
        f"Review pull request #{pr_number} in repository {repo!r}. "
        f"Fetch the diff, identify all issues, and return a structured review."
    )

    result = await agent.arun(
        user_message,
        response_model=PRReview,   # Agent returns a validated PRReview instance
    )
    return result

async def post_review_comments(repo: str, pr_number: int, review: PRReview):
    """Post the review comments back to GitHub."""
    for comment in review.comments:
        if comment.severity in ("critical", "warning"):
            await github_tool.post_review_comment(
                repo=repo,
                pr_number=pr_number,
                path=comment.file_path,
                line=comment.line,
                body=f"**[{comment.severity.upper()}]** {comment.message}",
            )
    print(f"Posted {len([c for c in review.comments if c.severity in ('critical','warning')])} comments.")
```

## Complete working example

```python
import asyncio
from pydantic import BaseModel, Field
from typing import Literal, Optional
from synapsekit import LLMConfig
from synapsekit.llms.openai import OpenAILLM
from synapsekit.agents import FunctionCallingAgent
from synapsekit.tools import GitHubTool

class ReviewComment(BaseModel):
    file_path: str
    line: int
    severity: Literal["critical", "warning", "suggestion", "praise"]
    category: Literal["bug", "security", "performance", "style", "test", "docs", "logic"]
    message: str

class PRReview(BaseModel):
    summary: str
    risk_level: Literal["high", "medium", "low"]
    comments: list[ReviewComment]
    approve: bool

async def main():
    github_tool = GitHubTool(token="GITHUB_TOKEN")

    llm = OpenAILLM(
        model="gpt-4o",
        config=LLMConfig(temperature=0.1, max_tokens=4096, json_mode=True),
    )

    agent = FunctionCallingAgent(
        llm=llm,
        tools=[github_tool],
        system_prompt=(
            "You are a senior software engineer. Review the PR diff carefully. "
            "Flag bugs, security issues, and missing tests. Be constructive and specific."
        ),
    )

    # Replace with a real repo and PR number
    repo = "your-org/your-repo"
    pr_number = 42

    print(f"Reviewing PR #{pr_number} in {repo}...\n")

    review: PRReview = await agent.arun(
        f"Review PR #{pr_number} in {repo!r}. Return a structured PRReview.",
        response_model=PRReview,
    )

    print(f"Risk level: {review.risk_level.upper()}")
    print(f"Approve: {'YES' if review.approve else 'NO'}")
    print(f"\nSummary:\n{review.summary}\n")

    by_severity = {}
    for c in review.comments:
        by_severity.setdefault(c.severity, []).append(c)

    for severity in ("critical", "warning", "suggestion", "praise"):
        comments = by_severity.get(severity, [])
        if comments:
            print(f"\n{severity.upper()} ({len(comments)})")
            for c in comments:
                print(f"  {c.file_path}:{c.line}  [{c.category}]")
                print(f"  {c.message}")

asyncio.run(main())
```

## Expected output

```
Reviewing PR #42 in your-org/your-repo...

Risk level: MEDIUM
Approve: NO

Summary:
This PR adds a new user authentication endpoint. The logic is sound but
there are two security issues that must be addressed before merging: a
missing rate limit and a SQL injection vector via unsanitised input.

CRITICAL (2)
  src/auth/login.py:47  [security]
  The `username` parameter is interpolated directly into the SQL query.
  Use parameterised queries: cursor.execute("SELECT ... WHERE username = ?", (username,))

  src/auth/login.py:91  [security]
  No rate limiting on this endpoint. Add a decorator or middleware to
  limit failed login attempts to 5 per minute per IP.

WARNING (1)
  tests/test_auth.py:12  [test]
  The test mocks the database but doesn't test the SQL injection case.
  Add a test with a payload like `username = "'; DROP TABLE users; --"`.

SUGGESTION (1)
  src/auth/login.py:34  [style]
  Consider extracting the token generation logic into a helper function
  to make it easier to unit-test in isolation.
```

## How it works

`FunctionCallingAgent` passes the LLM a set of tool schemas (JSON Schema representations of each tool's callable methods). The LLM responds with a tool call, the agent executes it, appends the result to the conversation, and loops until the LLM produces a final answer rather than another tool call. With `response_model=PRReview`, the final answer is parsed into a typed Pydantic instance.

`GitHubTool` uses the `PyGitHub` library under the hood and runs all network calls via `asyncio.get_running_loop().run_in_executor()` to avoid blocking the event loop.

## Variations

**Run on every PR automatically with a GitHub Action:**
```yaml
# .github/workflows/ai-review.yml
on: [pull_request]
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install synapsekit[openai,github]
      - run: python scripts/review_pr.py ${{ github.event.pull_request.number }}
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Review only changed files above a size threshold:**
```python
files = await github_tool.list_pr_files(repo=repo, pr_number=pr_number)
large_files = [f for f in files if f.changes > 50]
```

## Troubleshooting

**`403 Forbidden` from GitHub API**
Your PAT needs `repo` scope (or `pull_requests:write` for fine-grained tokens). Regenerate with the correct permissions.

**Agent loops without producing a review**
Add a `max_iterations=10` limit to `FunctionCallingAgent` to prevent infinite tool-call loops on unexpected LLM behaviour.

**Review is too long for the LLM context window**
Large PRs may exceed the context limit. Use `GitHubTool.get_pr_diff(max_lines=2000)` to truncate the diff before passing it to the agent.

## Next steps

- [Structured Output with Pydantic](../llms/structured-output-pydantic) — deeper dive into response schemas
- [Notion Knowledge Base](./notion-knowledge-base) — use RAG to answer questions about your codebase docs
- [SQL Analytics Agent](./sql-analytics-agent) — another FunctionCallingAgent pattern for data queries
