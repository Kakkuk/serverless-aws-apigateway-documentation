# Changelog

## v1.3.0 - Generate documentation preview locally
The serverless downloadDocumentation command can be used to download the final/deployed documentation directly from AWS.
This release adds support to (optionally) generate a documentation preview locally - without the need of deploying it to AWS.

## v1.3.1 - Fix documentation preview with nested $ref model
Fixes generating a documentation preview locally, with serverless `generateDocumentation` command, when the template contains a reference to another local model with the $ref keyword.

For example:
```yaml
$ref: "{{model: Address}}"
```
needed to be
```yaml
$ref: "#/components/schemas/Address"
```

See more [here](https://github.com/failsafe-engineering/serverless-aws-apigateway-documentation/issues/45)
