variable "aws_s3_bucket_name" {
  description = "Name of the shared S3 bucket for all Slack Notifier lambdas"
  type        = string
}

variable "aws_iam_role_name" {
  description = "Name of the shared IAM role for all Slack Notifier lambdas"
  type        = string
}

variable "aws_iam_policy_name" {
  description = "Name of the shared IAM policy for all Slack Notifier lambdas"
  type        = string
}

