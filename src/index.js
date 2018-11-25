'use strict'

const EcrApi = require('./EcrApi')
const K8sApi = require('./K8sApi')
const { loop, getExpectedImageName, findContainer } = require('./utils')
const config = require('./config')

const ecrApi = new EcrApi(config.aws)
const k8sApi = new K8sApi(config.k8s)

require('dotenv').config()

// This function gets called repeatedly, with the app sleeping INTERVAL ms between
// calls
loop(async function main () {
    // Get the image from ECR
    const image = ecrApi.getImageByTag(
        await ecrApi.getImages(config.ecrRepository),
        config.imageTag
    )

    if (!image) {
        console.error(`No images found with tag "${config.imageTag}"`)
        return
    }

    // Get a tag which isn't the same as `imageTag`
    const tag = image.imageTags.find((tag) => tag !== config.imageTag)
    if (!tag) {
        console.error(`Got an image with only one tag ("${config.imageTag}"). ` +
            'This agent requires that images are tagged with a common tag ' +
            '(like "production") and a unique tag, like a commit hash or an ' +
            'incrementing version number.')

        return
    }

    // Expected image name - used to find the correct container in the
    // deployment/statefulset
    const expectedImageName = getExpectedImageName(config.aws.region, image)

    // Currently can handle statefulsets and deployments only
    switch (config.resourceType) {
        case 'deployment':
        case 'statefulset':
            await maybeUpdateResource(expectedImageName, tag)
            break

        default:
            console.error(`Resource type "${config.resourceType}" isn't supported. ` +
                'This agent can only handle resource types of "deployment" and ' +
                '"statefulset".')

            return
    }
}, config.interval)

/**
 * Checks if the resource is using the latest tag already. Updates it if not
 * @param {string} expectedImageName
 * @param {string} newTag
 */
async function maybeUpdateResource (expectedImageName, newTag) {
    const methodNames = {
        get: config.resourceType === 'deployment' ? 'getDeployment' : 'getStatefulSet',
        update: config.resourceType === 'deployment' ? 'updateDeployment' : 'updateStatefulSet'
    }

    try {
        // Get the resource & correct container
        const resource = await k8sApi[methodNames.get](
            config.resourceName,
            config.k8s.namespace
        )

        const container = resource.spec.template.spec.containers.find(
            findContainer(expectedImageName)
        )

        if (!container) {
            console.error(`Couldn't find a container in ${config.resourceType} ` +
                `"${config.resourceName}" with an image which starts with ` +
                `"${expectedImageName}".`)

            return
        }

        // Get tag in use by the resource currently
        const [ currentImageName, currentImageTag ] = container.image.split(':')

        // Skip the rest if we're already using the most recent tag
        if (currentImageTag === newTag) {
            console.info(`Skipping ${config.resourceType} "${config.resourceName}" ` +
                `beacuse it is already using image tag "${newTag}"`)

            return
        }

        // If we've reached this point then an update is required
        const containerIdx = resource.spec.template.spec.containers.findIndex(
            findContainer(expectedImageName)
        )

        // Use the new image tag
        const patchResource = [{
            op: 'replace',
            path: `/spec/template/spec/containers/${containerIdx}/image`,
            value: `${currentImageName}:${newTag}`
        }]

        return k8sApi[methodNames.update](
            config.resourceName,
            patchResource,
            config.k8s.namespace
        )
    } catch (ex) {
        console.error(ex)
    }
}
