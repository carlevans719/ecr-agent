const request = require('request')
const { tryParseJson } = require('./utils')

/**
 * Contains methods for listing namespaces, stateful sets and deployments as
 * well as methods for updating stateful sets and deployments.
 */
class K8sApi {
    constructor ({ clusterName, kubeConfig }) {
        this.clusterName = clusterName

        this.kubeConfig = kubeConfig
        if (kubeConfig && typeof kubeConfig === 'string') {
            console.log('Decoding a Base64-encoded KubeConfig')
            this.kubeConfig = tryParseJson(Buffer.from(kubeConfig, 'base64').toString())
        }

        // Not working
        // if (!kubeConfig && fs.existsSync(K8sApi.SERVICEACCOUNT_TOKEN_PATH)) {
        //     console.log('Fabricating KubeConfig from data in pod')
        //     this._loadFromCluster()
        // }

        const requestContext = this._getRequestContext()
        this.genericRequest = this._genericRequestFactory(requestContext)
    }

    // Namespaces
    listNamespaces () {
        return this.genericRequest({
            method: 'GET',
            path: 'api/v1/namespaces'
        }).then(resp => resp.body.items)
    }

    // Stateful Sets
    listStatefulSets (namespaceName = 'default') {
        return this.genericRequest({
            method: 'GET',
            path: `apis/apps/v1/namespaces/${namespaceName}/statefulsets`
        }).then(resp => resp.body.items)
    }
    updateStatefulSet (name, body, namespaceName = 'default') {
        return this.genericRequest({
            path: `apis/apps/v1/namespaces/${namespaceName}/statefulsets/${name}`,
            method: 'PATCH',
            contentType: 'application/json-patch+json',
            body
        })
    }

    // Deployments
    listDeployments (namespaceName = 'default') {
        return this.genericRequest({
            method: 'GET',
            path: `apis/apps/v1/namespaces/${namespaceName}/deployments`
        }).then(resp => resp.body.items)
    }
    getDeployment (name, namespaceName = 'default') {
        return this.genericRequest({
            method: 'GET',
            path: `apis/apps/v1/namespaces/${namespaceName}/deployments/${name}`
        }).then(resp => resp.body)
    }
    updateDeployment (name, body, namespaceName = 'default') {
        return this.genericRequest({
            path: `apis/apps/v1/namespaces/${namespaceName}/deployments/${name}`,
            method: 'PATCH',
            contentType: 'application/json-patch+json',
            body
        })
    }

    _loadFromCluster (pathPrefix = '') {
        // const host = process.env.KUBERNETES_SERVICE_HOST
        // const port = process.env.KUBERNETES_SERVICE_PORT_HTTPS
        // const clusterName = this.clusterName
        // const contextName = this.clusterName
        // const userName = 'inClusterUser'

        // let scheme = 'https'
        // if (port === '80' || port === '8080' || port === '8001') {
        //     scheme = 'http'
        // }

        // this.clusterName = clusterName
        // this.kubeConfig = {
        //     clusters: [{
        //         name: clusterName,
        //         cluster: {
        //             caFile: `${pathPrefix}${K8sApi.SERVICEACCOUNT_CA_PATH}`,
        //             server: `${scheme}://${host}:${port}`,
        //             skipTLSVerify: false
        //         }
        //     }],
        //     users: [{
        //         name: userName,
        //         user: {
        //             'client-certificate-data': '',
        //             'client-key-data': '',
        //             token: fs.readFileSync(`${pathPrefix}${K8sApi.SERVICEACCOUNT_TOKEN_PATH}`).toString()
        //         }
        //     }],
        //     contexts: [{
        //         name: contextName,
        //         context: {
        //             cluster: clusterName,
        //             user: userName
        //         }
        //     }],
        //     currentContext: contextName
        // }
    }

    /**
     * Get a function which primes `request` for use with the K8s HTTP API
     *
     * @param {requestContext} context
     * @returns {Function}
     */
    _genericRequestFactory (context) {
        return function genericRequest ({
            method = 'POST',
            path = '',
            body = undefined,
            useQuerystring = false,
            pretty = false,
            contentType
        } = {}) {
            const queryParameters = {}
            const formParams = {}
            const headerParams = Object.assign(
                { authorization: `Bearer ${context.token}` },
                context.defaultHeaders || {}
            )

            if (contentType) {
                headerParams['content-type'] = contentType
            }

            if (!pretty) {
                queryParameters.pretty = pretty
            }

            const requestOptions = {
                method,
                qs: queryParameters,
                headers: headerParams,
                uri: `${context.cluster.server}/${path}`,
                useQuerystring,
                json: true,
                body,
                strictSSL: context.strictSSL
            }

            if (context.cert && context.key) {
                requestOptions.cert = context.cert
                requestOptions.key = context.key
            }

            if (Object.keys(formParams).length) {
                requestOptions.form = formParams
            }

            return new Promise((resolve, reject) => {
                request(requestOptions, (error, response, responseBody) => {
                    if (error) {
                        reject(error)
                    } else {
                        if (response.statusCode >= 200 && response.statusCode <= 299) {
                            resolve({ response: response, body: responseBody })
                        } else {
                            reject(new Error(JSON.stringify({ response, body: responseBody })))
                        }
                    }
                })
            })
        }
    }

    /**
     * Get the context for making requests
     *
     * @typedef {Object} requestContext
     * @property {{server: string}} cluster
     * @property {{user: string, name: string}} context
     * @property {{'client-certificate-data'?: string, 'client-key-data'?: string, name: string, token: string}} user
     * @property {Buffer} [cert]
     * @property {Buffer} [key]
     * @property {string} token
     * @property {boolean} [strictSSL]
     * @property {{[key: string]: string}} [defaultHeaders]
     *
     * @returns {requestContext}
     */
    _getRequestContext () {
        const findCluster = name => this.kubeConfig.clusters.find(cluster => cluster.name === name).cluster
        const findContext = name => this.kubeConfig.contexts.find(ctx => ctx.name === name).context
        const findUser = name => this.kubeConfig.users.find(usr => usr.name === name).user
        const maybeParseBase64 = (maybeString) => maybeString ? Buffer.from(maybeString, 'base64') : null

        const clusterName = this.clusterName // K8S_CLUSTER_NAME
        const context = findContext(clusterName)
        const user = findUser(context.user)
        const { token } = user

        const cert = maybeParseBase64(user['client-certificate-data'])
        const key = maybeParseBase64(user['client-key-data'])

        /** @type {requestContext} */
        return {
            cluster: findCluster(clusterName),
            context,
            user,
            cert,
            key,
            token,
            strictSSL: false
        }
    }
}

K8sApi.SERVICEACCOUNT_ROOT = '/var/run/secrets/kubernetes.io/serviceaccount'
K8sApi.SERVICEACCOUNT_CA_PATH = K8sApi.SERVICEACCOUNT_ROOT + '/ca.crt'
K8sApi.SERVICEACCOUNT_TOKEN_PATH = K8sApi.SERVICEACCOUNT_ROOT + '/token'

module.exports = K8sApi
