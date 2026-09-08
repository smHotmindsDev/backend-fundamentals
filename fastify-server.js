import Fastify from 'fastify';
import { errorCodes } from 'fastify'
import fastifyExpress from '@fastify/express'; // To support express-like middleware, because since starting with Fastify v3.0.0, middleware is not supported out of the box
const environment = process.env.NODE_ENV || 'development';

/*
Instead of express-like middleware for logging,
used a native logger built into Fastify
*/
const envToLogger = {
  development: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
    serializers: {
          req (request) {
            return {
              method: request.method,
              url: request.url,
              headers: request.headers,
              host: request.host,
              remoteAddress: request.ip,
              remotePort: request.socket.remotePort
            }
          }
        }
  },
  production: true
}

const fastify = Fastify({
  logger: envToLogger[environment] ?? true
})

// Declare a route
fastify.get('/', function (request, reply) {
  const authHeader = request.headers.authorization;

  !authHeader && reply.code(403).send({ jwt: 'invalid' })

  if (authHeader === process.env.DEMO_JWT) {
    return "Hello"
  } else {
    reply.code('bad status').send({ jwt: 'uncorrected' })
  }
})

fastify.setErrorHandler(function (error, request, reply) {
  if (error instanceof errorCodes.FST_ERR_BAD_STATUS_CODE) {
    // Log error
    this.log.error(error)
    // Send error response
    reply.status(403).send({ page: "Forbidden" })
  } else {
    // fastify will use parent error handler to handle this
    reply.send(error)
  }
})

fastify.addSchema({
  $id: 'loginBodySchema',
  type: 'object',
  required: ['username', 'password'],
  properties: {
    username: { type: 'string', minLength: 3  },
    password: { type: 'string', minLength: 4  }
  }
})

fastify.post(
  '/login',
  {
    schema: {
      body: { $ref: 'loginBodySchema#' }
    }
  }, async (request, reply
  ) => {
    const { username, password } = request.body

    if (username === process.env.DEMO_USERNAME && password === process.env.DEMO_PASSWORD) {
      return {
        "status": "success",
        "token": process.env.DEMO_JWT,
        "token_type": "Bearer",
      }
    } else {
      return {
        "status": "false"
      }
    }
})

fastify.get('*', function (request, reply) {
  reply.code(404).send({ page: 'not found' })
})

/**
 * Run the server!
 */
const start = async () => {
  try {
    await fastify.listen({ port: 8000  })
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start()
