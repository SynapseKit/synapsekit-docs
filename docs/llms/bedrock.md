---
sidebar_position: 8
---

# AWS Bedrock

Run Claude, Titan, Llama, Mistral, and other models via AWS Bedrock. Uses your AWS credentials -- no separate AI vendor account needed.

## Install

```bash
pip install synapsekit[bedrock]
```

## Authentication

AWS Bedrock uses the standard AWS credential chain. Choose the method that fits your deployment:

### Option 1: Environment variables

```bash
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...
export AWS_DEFAULT_REGION=us-east-1
```

### Option 2: AWS CLI profile

```bash
aws configure
# or
aws configure --profile myprofile
```

### Option 3: IAM role (recommended for EC2/ECS/Lambda)

No configuration needed -- Bedrock automatically uses the instance/task role.

### Option 4: AWS SSO

```bash
aws sso login --profile my-sso-profile
```

## Via the RAG facade

```python
from synapsekit import RAG

rag = RAG(
    model="anthropic.claude-3-5-sonnet-20241022-v2:0",
    api_key="env",   # uses AWS credential chain
    provider="bedrock",
)
rag.add("Your document text here")
answer = rag.ask_sync("Summarize the document.")
```

## Direct usage

```python
from synapsekit.llm.bedrock import BedrockLLM
from synapsekit.llm.base import LLMConfig

llm = BedrockLLM(
    LLMConfig(
        model="anthropic.claude-3-haiku-20240307-v1:0",
        api_key="env",
        provider="bedrock",
        temperature=0.3,
        max_tokens=1024,
    ),
    region="us-east-1",
)

async for token in llm.stream("What is SynapseKit?"):
    print(token, end="", flush=True)
```

## Supported models

| Provider | Model | Bedrock Model ID |
|---|---|---|
| Anthropic | Claude 3.5 Sonnet v2 | `anthropic.claude-3-5-sonnet-20241022-v2:0` |
| Anthropic | Claude 3.5 Haiku | `anthropic.claude-3-5-haiku-20241022-v1:0` |
| Anthropic | Claude 3 Haiku | `anthropic.claude-3-haiku-20240307-v1:0` |
| Meta | Llama 3.1 70B | `meta.llama3-1-70b-instruct-v1:0` |
| Meta | Llama 3.1 8B | `meta.llama3-1-8b-instruct-v1:0` |
| Mistral | Mixtral 8x7B | `mistral.mixtral-8x7b-instruct-v0:1` |
| Amazon | Titan Text G1 | `amazon.titan-text-express-v1` |

:::note
You must enable model access in the AWS Console before using a model. Go to Amazon Bedrock > Model access and request access to the models you need.
:::

## Function calling

```python
from synapsekit.tools import tool
from synapsekit.agents import FunctionCallingAgent

@tool
def query_s3_bucket(bucket_name: str, prefix: str = "") -> list[str]:
    """List objects in an S3 bucket with an optional prefix filter."""
    import boto3
    s3 = boto3.client("s3")
    response = s3.list_objects_v2(Bucket=bucket_name, Prefix=prefix)
    return [obj["Key"] for obj in response.get("Contents", [])]

@tool
def describe_ec2_instance(instance_id: str) -> dict:
    """Get details about an EC2 instance."""
    import boto3
    ec2 = boto3.client("ec2")
    response = ec2.describe_instances(InstanceIds=[instance_id])
    instance = response["Reservations"][0]["Instances"][0]
    return {
        "id": instance["InstanceId"],
        "type": instance["InstanceType"],
        "state": instance["State"]["Name"],
    }

llm = BedrockLLM(
    LLMConfig(
        model="anthropic.claude-3-5-sonnet-20241022-v2:0",
        api_key="env",
        provider="bedrock",
    ),
    region="us-east-1",
)
agent = FunctionCallingAgent(llm=llm, tools=[query_s3_bucket, describe_ec2_instance])

result = await agent.arun(
    "List all objects in the 'my-data-bucket' bucket with prefix 'reports/2024/'"
)
print(result)
```

## Custom boto3 session

Use a specific AWS profile or cross-account role:

```python
import boto3

session = boto3.Session(
    profile_name="production",
    region_name="us-west-2",
)

llm = BedrockLLM(
    LLMConfig(model="anthropic.claude-3-haiku-20240307-v1:0", api_key="env"),
    boto3_session=session,
)
```

## IAM permissions

Your IAM role or user needs the `bedrock:InvokeModel` permission:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "bedrock:InvokeModel",
                "bedrock:InvokeModelWithResponseStream"
            ],
            "Resource": [
                "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0"
            ]
        }
    ]
}
```

Use `"Resource": "*"` to allow all Bedrock models.

## Cost tracking

```python
from synapsekit import CostTracker

tracker = CostTracker()
llm = BedrockLLM(
    LLMConfig(model="anthropic.claude-3-haiku-20240307-v1:0", api_key="env"),
    region="us-east-1",
)

with tracker.scope("bedrock-request"):
    response = await llm.generate("Summarize this AWS architecture document...")
    rec = tracker.record("claude-3-haiku", input_tokens=200, output_tokens=400)

print(f"Cost: ${rec.cost_usd:.6f}")
```

## Error handling

```python
import botocore.exceptions

try:
    response = await llm.generate("Hello")
except botocore.exceptions.NoCredentialsError:
    print("AWS credentials not found -- run 'aws configure' or set environment variables")
except botocore.exceptions.ClientError as e:
    error_code = e.response["Error"]["Code"]
    if error_code == "AccessDeniedException":
        print("IAM permissions missing -- add bedrock:InvokeModel to your policy")
    elif error_code == "ValidationException":
        print("Model not available in this region or model access not enabled")
    else:
        print(f"AWS error: {e}")
```

## Environment variables

| Variable | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `AWS_DEFAULT_REGION` | AWS region (e.g. `us-east-1`) |
| `AWS_PROFILE` | AWS CLI profile name |

## See also

- [AWS Bedrock docs](https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html)
- [Bedrock model access](https://us-east-1.console.aws.amazon.com/bedrock/home#/modelaccess)
- [Function calling agents](../agents/function-calling)
- [Cost tracking](../observability/cost-tracker)
