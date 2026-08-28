terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region  = var.aws_region
  profile = "terraform"
}

resource "aws_s3_bucket" "fx_data_archive" {
  bucket = var.bucket_name

  tags = {
    Project     = "fx-rate-analytics-pipeline"
    Environment = "portfolio-demo"
  }
}

resource "aws_s3_bucket_versioning" "fx_data_archive_versioning" {
  bucket = aws_s3_bucket.fx_data_archive.id

  versioning_configuration {
    status = "Enabled"
  }
}