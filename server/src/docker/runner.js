const Docker = require('dockerode');
const path = require('path');
const fs = require('fs');

// Connect to Docker Desktop running on your machine
const docker = new Docker();

async function runFunctionInDocker(functionName, event) {
  const functionsPath = path.join(__dirname, '../../functions', functionName);

  // Check function exists
  if (!fs.existsSync(functionsPath)) {
    throw new Error(`Function "${functionName}" not found`);
  }

  console.log(`🐳 Starting Docker container for function "${functionName}"...`);

  // Convert the event object to a JSON string
  // We'll pass it as an environment variable into the container
  const eventJson = JSON.stringify(event);

  try {
    // This is the core Docker magic:
    // 1. Pulls node:18-alpine image (tiny Node.js image, ~50MB)
    // 2. Mounts your function folder into the container
    // 3. Passes the event as ENV variable
    // 4. Runs handler.js inside the container
    // 5. Captures all output
    // 6. Container auto-destroys after done
    const output = await runContainer({
      image: 'node:18-alpine',
      functionPath: functionsPath,
      eventJson
    });

    console.log(`✅ Container finished. Output:\n${output}`);
    return { success: true, output };

  } catch (err) {
    console.error(`❌ Container error:`, err.message);
    return { success: false, error: err.message };
  }
}

function runContainer({ image, functionPath, eventJson }) {
  return new Promise(async (resolve, reject) => {
    try {
      // Create a tiny wrapper script that:
      // 1. Reads the event from ENV
      // 2. Requires the user's handler.js
      // 3. Calls handler(event)
      // 4. Prints the result
      const runnerScript = `
        const event = JSON.parse(process.env.POCKET_EVENT);
        const fn = require('/function/handler.js');
        Promise.resolve(fn.handler(event))
          .then(result => {
            console.log(JSON.stringify(result));
          })
          .catch(err => {
            console.error('Function error:', err.message);
            process.exit(1);
          });
      `;

      // Create the container
      const container = await docker.createContainer({
        Image: image,

        // Run node with our inline script
        Cmd: ['node', '-e', runnerScript],

       Env: [
          `POCKET_EVENT=${eventJson}`,
          `ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY || ''}`
         ],

        HostConfig: {
          // Mount the function folder into /function inside container
          // 'ro' = read only (security — function can't modify itself)
         Binds: [
         `${functionPath}:/function:ro`,
         `${path.join(__dirname, '../../storage')}:/app/storage:ro`
          ],
NetworkMode: 'bridge',
          // Auto remove container when it's done
          AutoRemove: true,

          // Kill container if it runs longer than 10 seconds
          // Prevents infinite loops
          NanoCpus: 500000000,  // 0.5 CPU
          Memory: 128 * 1024 * 1024  // 128MB RAM limit
        },

        // Capture all output
        AttachStdout: true,
        AttachStderr: true
      });

      // Start the container
      await container.start();

      // Stream output from container
      const stream = await container.logs({
        follow: true,
        stdout: true,
        stderr: true
      });

      let output = '';

      // Collect all output chunks
      container.modem.demuxStream(
        stream,
        { write: (chunk) => { output += chunk.toString(); } }, // stdout
        { write: (chunk) => { output += chunk.toString(); } }  // stderr
      );

      // Wait for container to finish
      await container.wait();

      resolve(output.trim());

    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { runFunctionInDocker };