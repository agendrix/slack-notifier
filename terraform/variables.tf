variable "lambda_name" {
  description = "Function name"
  type        = string
}

variable "slack_channel" {
  description = "Slack channel to post messages to"
  type        = string
}

variable "slack_url" {
  description = "Slack URL of your organization workspace"
  type        = string

  validation {
    condition     = regex(".*\\.slack\\.com", var.slack_url)
    error_message = "The slack_url is invalid."
  }
}

variable "repo" {
  description = "GitHub repository of the project"
  type = object({
    owner  = string
    name   = string
    branch = string
  })
}

variable "shared_module" {
  description = "Shared module from ./shared"
  type        = any # module
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

variable "slack_access_token" {
  description = "Access token for the Slack bot"
  type        = string
}

variable "github_oauth_token" {
  description = "Oauth token to fetch private repos"
  type        = string
  default     = null
}
