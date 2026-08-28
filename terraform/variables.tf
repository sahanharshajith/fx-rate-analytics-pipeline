variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "ap-southeast-1"
}

variable "bucket_name" {
  description = "Globally-unique S3 bucket name for FX Bronze archive"
  type        = string
}
