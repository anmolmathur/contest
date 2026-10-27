#!/usr/bin/env bash
# Create the private S3 bucket + least-privilege IAM user for contest uploads.
# Needs the AWS CLI configured with an admin-capable profile (run it yourself;
# nothing here is run by the app).
#
#   BUCKET=tl-contest-uploads REGION=ap-south-1 \
#   ORIGINS="https://contest.anmolmathur.com https://hackathon.teamleaseedtech.com" \
#   ./scripts/s3-setup.sh
#
# Prints the env vars to put in the contest container. Files stay private: the
# app serves /uploads/<key> by redirecting to a 15-minute signed URL.
set -euo pipefail
BUCKET="${BUCKET:?set BUCKET}"
REGION="${REGION:-ap-south-1}"
ORIGINS="${ORIGINS:?set ORIGINS (space-separated https origins that upload from the browser)}"
PREFIX="${PREFIX:-uploads/}"
IAM_USER="${IAM_USER:-contest-uploads-app}"

if [ "$REGION" = "us-east-1" ]; then
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION"
else
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
    --create-bucket-configuration "LocationConstraint=$REGION"
fi
aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-encryption --bucket "$BUCKET" --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws s3api put-bucket-versioning --bucket "$BUCKET" --versioning-configuration Status=Enabled

# Browser uploads are presigned PUTs, so the bucket needs CORS for the app origins.
ORIGINS_JSON=$(printf '"%s",' $ORIGINS | sed 's/,$//')
aws s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration "{
  \"CORSRules\":[{\"AllowedOrigins\":[$ORIGINS_JSON],\"AllowedMethods\":[\"PUT\",\"GET\"],
  \"AllowedHeaders\":[\"*\"],\"ExposeHeaders\":[\"ETag\"],\"MaxAgeSeconds\":3000}]}"

aws iam create-user --user-name "$IAM_USER" >/dev/null
aws iam put-user-policy --user-name "$IAM_USER" --policy-name contest-uploads --policy-document "{
  \"Version\":\"2012-10-17\",
  \"Statement\":[{\"Effect\":\"Allow\",\"Action\":[\"s3:PutObject\",\"s3:GetObject\"],
  \"Resource\":\"arn:aws:s3:::$BUCKET/${PREFIX}*\"}]}"
KEY_JSON=$(aws iam create-access-key --user-name "$IAM_USER")

cat <<OUT

Add to the contest service (e.g. cloud/env or compose environment):
  AWS_S3_BUCKET=$BUCKET
  AWS_S3_REGION=$REGION
  AWS_S3_PREFIX=$PREFIX
  AWS_ACCESS_KEY_ID=$(echo "$KEY_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin)["AccessKey"]["AccessKeyId"])')
  AWS_SECRET_ACCESS_KEY=$(echo "$KEY_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin)["AccessKey"]["SecretAccessKey"])')

Existing local files keep working. To move them into the bucket:
  aws s3 sync <uploads-volume-dir>/ s3://$BUCKET/$PREFIX
OUT
