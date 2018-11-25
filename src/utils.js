'use strict'

/**
 * Takes a function `reject` to call on failure and a function `next` to call on success.
 * Returns a function with a standard nodejs callback signature.
 * Failure is whether the `err` argument passed to the returned function is truthy.
 *
 * @param {function} reject
 * @param {function} next
 * @returns {function}
 *
 * @example
 *   function getTheThing () {
 *       return new Promise((resolve, reject) => {
 *           doSomethingAsync(
 *               rejectOnError(reject, (data) => {
 *                   // note there is no error parameter
 *                   resolve(data.interestingProperty)
 *               })
 *           )
 *       })
 *   }
 */
exports.rejectOnError = (reject, next) => (err, data) => {
    if (err) {
        return reject(err)
    }

    return next(data)
}

exports.tryParseJson = (maybeJsonString, fallback = {}) => {
    try {
        return JSON.parse(maybeJsonString)
    } catch (ex) {
        return fallback
    }
}

// Promise which resolves after `duration` milliseconds
const sleep = exports.sleep = (duration) => new Promise((resolve) => {
    setTimeout(resolve, duration)
})

// Function which calls `func` forever, sleeping between calls for `sleepDuration`
// ms. Returns a handle which consumer can call `.stop()` on to stop the loop
exports.loop = (func, sleepDuration) => {
    let cancelled = false

    setTimeout(async () => {
        while (true) {
            if (cancelled) {
                break
            }

            try {
                const res = func()
                if (res.then) {
                    await res
                }
            } catch (e) {
                console.error(e)
            }

            await sleep(sleepDuration)
        }
    }, 0)

    return {
        stop: () => {
            cancelled = true
        }
    }
}

/**
 * @example
 *     region: 'eu-west-1'
 *     registryId: '123456789'
 *     repositoryName: 'my-app'
 *     image: '123456789.dkr.ecr.eu-west-1.amazonaws.com/my-app:v1'
 */
exports.getExpectedImageName = (region, { registryId, repositoryName }) => {
    return `${registryId}.dkr.ecr.${region}.amazonaws.com/${repositoryName}:`
}

exports.findContainer = (imageName) => {
    return (container) => container.image.startsWith(imageName)
}
