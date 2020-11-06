variable "lambda_name" {
  description = "Function name"
  type        = string
}

variable "repo" {
  description = "GitHub repository of the project"
  type = object({
    owner = string
    name  = string
  })
}

variable "slack_config" {
  description = "Slack configuration"
  type = object({
    channel      = string # Slack channel to post messages to
    url          = string # Slack URL of your organization workspace
    access_token = string # Access token for the Slack bot
  })

  validation {
    condition     = substr(var.slack_config.url, length(var.slack_config.url) - 10, 10) == ".slack.com"
    error_message = "The slack url is invalid."
  }
}

variable "deployment_type" {
  description = "Type of deployment supported by the Slack Notifier"
  type        = string

  validation {
    condition     = contains(["GitHub Actions", "CodePipeline"], var.deployment_type)
    error_message = "The selected deployment_type is not supported."
  }
}

variable "api_secret" {
  description = "Required for GitHub Actions deployments. Secret to enable sending events through the API Gateway"
  default     = null
  type        = string
}

variable "codepipeline_refs" {
  description = "Required for CodePipeline deployments."
  default     = null
  type = object({
    region                      = string # AWS region of the CodePipeline
    account_id                  = string # AWS Account Id
    github_deployment_branch    = string # Branch used by CodePipeline to deploy the app
    codepipeline                = any    # aws_codepipeline
    codedeploy_deployment_group = any    # aws_codedeploy_deployment_group
    ecr_ref_repository          = any    # Name of the ECR repository to fetch latest deployment from.
  })
}

variable "environment" {
  description = "Name of the environment"
  type        = string
  default     = "test"
}

variable "github_oauth_token" {
  description = "Oauth token to fetch private repos"
  type        = string
  default     = null
}

variable "bucket" {
  description = "S3 bucket to save lambda data"
  type        = any # aws_s3_bucket
}

variable "role_arn" {
  description = "Lambda IAM role"
  type        = string
}
