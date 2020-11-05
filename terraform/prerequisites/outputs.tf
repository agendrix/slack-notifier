output "bucket" {
  value = aws_s3_bucket.shared_bucket.bucket
}

output "role_arn" {
  value = aws_iam_role.slack_notifier.arn
}
