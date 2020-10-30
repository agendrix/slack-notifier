resource "aws_s3_bucket" "shared_bucket" {
  bucket = var.aws_s3_bucket_name
  acl    = "private"
}

resource "aws_iam_policy" "slack_notifier" {
  name = var.aws_iam_policy_name

  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "codepipeline:GetPipelineState",
        "codepipeline:ListActionExecutions",
        "codepipeline:GetPipelineExecution",
        "ecr:ListImages",
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:Get*",
        "s3:List*",
        "s3:PutObject"
      ],
      "Resource": [
        "${aws_s3_bucket.shared_bucket.arn}",
        "${aws_s3_bucket.shared_bucket.arn}/*"
      ]
    }
  ]
}
EOF

}

resource "aws_iam_role" "slack_notifier" {
  name = var.aws_iam_role_name

  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
}
EOF

}

resource "aws_iam_role_policy_attachment" "slack_notifier" {
  role       = aws_iam_role.slack_notifier.name
  policy_arn = aws_iam_policy.slack_notifier.arn
}
