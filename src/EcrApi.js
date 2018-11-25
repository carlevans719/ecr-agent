'use strict'

const { rejectOnError } = require('./utils')

module.exports = class EcrApi {
    constructor (config) {
        const AWS_ECR = require('aws-sdk/clients/ecr')

        this.awsEcr = new AWS_ECR({
            region: config.region,
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey
            }
        })
    }

    /** @returns {Promise<AWS.ECR.Repository[]>} */
    getRepositories () {
        return new Promise((resolve, reject) => {
            this.awsEcr.describeRepositories(
                {},
                rejectOnError(reject, (data) => resolve(data.repositories))
            )
        })
    }

    /**
     * @param {AWS.ECR.Repository[]} repositories
     * @param {string} name
     * @returns {AWS.ECR.Repository}
     */
    getRepositoryByName (repositories, name) {
        return repositories.find((repo) => repo.repositoryName === name)
    }

    /** @returns {Promise<AWS.ECR.ImageDetail[]>} */
    getImages (repositoryName) {
        return new Promise((resolve, reject) => {
            this.awsEcr.describeImages(
                { repositoryName },
                rejectOnError(reject, (data) => resolve(data.imageDetails))
            )
        })
    }

    /**
     * @param {AWS.ECR.ImageDetail[]} images
     * @param {string} imageTag
     * @returns {AWS.ECR.ImageDetail}
     */
    getImageByTag (images, imageTag) {
        return images.find((image) => image.imageTags.includes(imageTag))
    }
}
