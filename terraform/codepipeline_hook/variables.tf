variable "lambda_function" {
  description = "Slack Notifier lambda function"
  type        = any # aws_lambda_function
}

variable "repo_name" {
  description = "Name of the repo"
  type        = string
}

variable "codepipeline_refs" {
  description = "Required for CodePipeline deployments."
  default     = null
  type = object({
    region                      = string
    account_id                  = string
    codepipeline                = any # aws_codepipeline
    codedeploy_deployment_group = any # aws_codedeploy_deployment_group
    ecr_ref_repository          = any # Name of the ECR repository to fetch latest deployment from.
  })
}
