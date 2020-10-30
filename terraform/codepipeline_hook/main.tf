resource "aws_cloudwatch_event_target" "send_codepipeline_events_to_lambda" {
  rule = aws_cloudwatch_event_rule.codepipeline_event_for_slack_lambda.name
  arn  = var.lambda_function.arn
}

resource "aws_cloudwatch_event_target" "send_codedeploy_events_to_lambda" {
  rule = aws_cloudwatch_event_rule.codedeploy_event_for_slack_lambda.name
  arn  = var.lambda_function.arn
}

resource "aws_lambda_permission" "allow_cloudwatch_codepipeline_events_to_call_slack_notifier" {
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_function.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.codepipeline_event_for_slack_lambda.arn
}

resource "aws_lambda_permission" "allow_cloudwatch_codedeploy_events_to_call_slack_notifier" {
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_function.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.codedeploy_event_for_slack_lambda.arn
}

resource "aws_cloudwatch_event_rule" "codepipeline_event_for_slack_lambda" {
  name = "SlackNotifier-CodePipelineEvent-for-${var.repo_name}"

  event_pattern = <<PATTERN
{
  "source": [
    "aws.codepipeline"
  ],
  "detail-type": [
    "CodePipeline Pipeline Execution State Change"
  ],
  "resources": [
    "${var.codepipeline_refs.codepipeline.arn}"
  ]
}
PATTERN

}

resource "aws_cloudwatch_event_rule" "codedeploy_event_for_slack_lambda" {
  name = "SlackNotifier-CodeDeployEvent-for-${var.repo_name}"

  event_pattern = <<PATTERN
{
  "source": [
    "aws.codedeploy"
  ],
  "detail-type": [
    "CodeDeploy Deployment State-change Notification",
    "CodeDeploy Instance State-change Notification"
  ],
  "resources": [
    "arn:aws:codedeploy:${var.codepipeline_refs.region}:${var.codepipeline_refs.account_id}:application:${var.codepipeline_refs.codedeploy_deployment_group.app_name}",
    "arn:aws:codedeploy:${var.codepipeline_refs.region}:${var.codepipeline_refs.account_id}:deploymentgroup:${var.codepipeline_refs.codedeploy_deployment_group.app_name}/${var.codepipeline_refs.codedeploy_deployment_group.deployment_group_name}"
  ]
}
PATTERN

}
