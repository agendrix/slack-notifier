locals {
  slack_lambda_zip = "${path.module}/lambda.zip"

  deployement_type_variables = (var.deployment_type == "CodePipeline") ? {
    CODEPIPELINE_CONFIG = jsonencode({
      pipelineName     = var.codepipeline_refs.codepipeline.name
      ecrRefRepository = var.codepipeline_refs.ecr_ref_repository
    })
    } : {
    API_SECRET = var.api_secret
  }
}

resource "aws_lambda_function" "lambda" {
  filename      = local.slack_lambda_zip
  function_name = var.lambda_name
  role          = var.shared_module.role_arn
  handler       = "index.handler"

  source_code_hash = filebase64sha256(local.slack_lambda_zip)

  runtime = "nodejs10.x"

  environment {
    variables = merge({
      ENV          = var.environment
      GITHUB_TOKEN = var.github_oauth_token
      REPO         = jsonencode(var.repo)
      SLACK_CONFIG = jsonencode({
        channel     = var.slack_channel
        url         = var.slack_url
        accessToken = var.slack_access_token
      })
      S3 = jsonencode({
        bucket = var.shared_module.bucket
        key    = var.lambda_name
      })
    }, local.deployement_type_variables)
  }

  depends_on = [var.shared_module]
}

resource "aws_cloudwatch_log_group" "log_group" {
  name              = "/aws/lambda/${aws_lambda_function.lambda.function_name}"
  retention_in_days = 14
}

module "codepipeline_events_hook" {
  count  = var.deployment_type == "CodePipeline" ? 1 : 0
  source = "./codepipeline_hook"

  lambda_function   = aws_lambda_function.lambda
  repo_name         = var.repo.name
  codepipeline_refs = var.codepipeline_refs
}

