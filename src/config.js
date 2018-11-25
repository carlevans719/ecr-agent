'use strict'

/**
 * Used for making requests to ECR
 */
exports.aws = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'eu-west-1'
}

/**
 * Used for making requests to EKS/K8s API
 */
exports.k8s = {
    clusterName: process.env.K8S_CLUSTER_NAME,
    kubeConfig: process.env.K8S_KUBECONFIG,
    namespace: process.env.K8S_NAMESPACE || 'default'
}

/**
 * How often to poll ECR
 */
exports.interval = process.env.INTERVAL || 30000

/**
 * The cannonical tag to look for on ECR
 */
exports.imageTag = process.env.IMAGE_TAG || 'latest'

/**
 * The ECR repository to look in
 */
exports.ecrRepository = process.env.ECR_REPOSITORY

/**
 * The K8s resource type to try update (can be "deployment" or "statefulset")
 */
exports.resourceType = process.env.RESOURCE_TYPE || 'deployment'

/**
 * The name of the K8s resource to try update
 */
exports.resourceName = process.env.RESOURCE_NAME
