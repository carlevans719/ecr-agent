# Kubernetes ECR agent

This agent will update the specified Deployment / StatefulSet when it detects a new version of the image which they use has been pushed to ECR.

It does this by polling ECR every `INTERVAL` milliseconds to see if an image has been pushed with a specified tag.

The idea is that your CI pipeline will build the Docker image and tag it with a unique version number and push it to ECR, then it will tag it with "production" (or whatever `IMAGE_TAG` is set to) and pushing that tag to ECR too.

The agent will then read the "production" image, find the other tag (for example "v1") and then look at the current image name for the K8s resource by making a request to the management API. If the version differs (for example, if the Deployment is using "v0.1") then the agent will update the Deployment manifest to use tag "v1" instead. Kubernetes will then manage replacing the pods.

## Limitations

- Currently one agent per ECR image / Kubernetes resource. (PRs welcome!)
- Only Deployments and StatefulSets are supported
- ECR images should only have two tags - any more will be ignored
- Must pass in a Base64-encoded Kubeconfig as the "read from pod" code isn't working (PRs welcome!)

## Usage

### Local

First build the image:

`docker build . -t ecr-agent:latest`

Next run the image

```shell
docker run -it \
--env AWS_ACCESS_KEY_ID=<REDACTED> \
--env AWS_SECRET_ACCESS_KEY=<REDACTED> \
--env AWS_REGION=eu-west-1 \
--env K8S_CLUSTER_NAME=<REDACTED> \
--env K8S_KUBECONFIG=<REDACTED> \
--env INTERVAL=30000 \
--env IMAGE_TAG=latest \
--env ECR_REPOSITORY=sample-app \
--env RESOURCE_TYPE=deployment \
--env RESOURCE_NAME=sample-app \
ecr-agent:latest \
node bundle.js
```

### On Cluster

Edit the environment variable values in `./ecr-agent.replicaset.yaml`. Optionally specify your own hosted image.

Then create the ReplicaSet resource:
`kubectl apply -f ecr-agent.replicaset.yaml`