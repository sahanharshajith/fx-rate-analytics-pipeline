output "bucket_arn" {
  value = aws_s3_bucket.fx_data_archive.arn
}

output "bucket_name" {
  value = aws_s3_bucket.fx_data_archive.bucket
}
