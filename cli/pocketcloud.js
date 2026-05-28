#!/usr/bin/env node
// ☝️ This line tells the OS to run this file with Node.js
// It's what makes it work as a real CLI command

const { Command } = require('commander');
const chalk = require('chalk');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Base URL of our PocketCloud server
const BASE_URL = 'http://localhost:4566';

const program = new Command();

// CLI name and version shown in --help
program
  .name('pocketcloud')
  .description('☁️  PocketCloud CLI — Local AWS Simulator')
  .version('1.0.0');

// ─────────────────────────────────────────
// BUCKET COMMANDS
// pocketcloud bucket create <name>
// pocketcloud bucket list
// pocketcloud bucket delete <name>
// ─────────────────────────────────────────
const bucket = program.command('bucket')
  .description('Manage buckets');

// CREATE bucket
bucket
  .command('create <name>')
  .description('Create a new bucket')
  .action(async (name) => {
    try {
      const res = await axios.post(`${BASE_URL}/buckets/${name}`);
      console.log(chalk.green('✅ Bucket created!'));
      console.log(chalk.cyan(`   Name: ${res.data.bucket.name}`));
      console.log(chalk.gray(`   Created: ${res.data.bucket.createdAt}`));
    } catch (err) {
      console.log(chalk.red('❌ Error:'), err.response?.data?.error || err.message);
    }
  });

// LIST buckets
bucket
  .command('list')
  .description('List all buckets')
  .action(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/buckets`);
      const buckets = res.data.buckets;

      if (buckets.length === 0) {
        console.log(chalk.yellow('No buckets found.'));
        return;
      }

      console.log(chalk.cyan('\n📦 Buckets:'));
      buckets.forEach(b => {
        console.log(chalk.white(`   • ${b.name}`));
      });
      console.log('');
    } catch (err) {
      console.log(chalk.red('❌ Error:'), err.response?.data?.error || err.message);
    }
  });

// DELETE bucket
bucket
  .command('delete <name>')
  .description('Delete a bucket')
  .action(async (name) => {
    try {
      await axios.delete(`${BASE_URL}/buckets/${name}`);
      console.log(chalk.green(`✅ Bucket "${name}" deleted`));
    } catch (err) {
      console.log(chalk.red('❌ Error:'), err.response?.data?.error || err.message);
    }
  });

// ─────────────────────────────────────────
// OBJECT COMMANDS
// pocketcloud upload <filePath> <bucket>
// pocketcloud list-objects <bucket>
// pocketcloud download <bucket> <key>
// pocketcloud delete-object <bucket> <key>
// ─────────────────────────────────────────

// UPLOAD file
program
  .command('upload <filePath> <bucket>')
  .description('Upload a file to a bucket')
  .action(async (filePath, bucketName) => {
    try {
      // Resolve full path in case user types relative path
      const fullPath = path.resolve(filePath);

      if (!fs.existsSync(fullPath)) {
        console.log(chalk.red(`❌ File not found: ${fullPath}`));
        return;
      }

      // Get just the filename to use as the key
      const key = path.basename(fullPath);

      // Build form-data with the file attached
      const form = new FormData();
      form.append('file', fs.createReadStream(fullPath));

      console.log(chalk.gray(`⬆️  Uploading "${key}" to bucket "${bucketName}"...`));

      const res = await axios.put(
        `${BASE_URL}/buckets/${bucketName}/objects/${key}`,
        form,
        { headers: form.getHeaders() }
      );

      console.log(chalk.green('✅ Upload successful!'));
      console.log(chalk.cyan(`   Key: ${res.data.object.key}`));
      console.log(chalk.cyan(`   Bucket: ${res.data.object.bucket}`));
      console.log(chalk.cyan(`   Type: ${res.data.object.mimeType}`));
      console.log(chalk.gray(`   Uploaded: ${res.data.object.uploadedAt}`));
    } catch (err) {
      console.log(chalk.red('❌ Error:'), err.response?.data?.error || err.message);
    }
  });

// LIST objects in bucket
program
  .command('list-objects <bucket>')
  .description('List all files in a bucket')
  .action(async (bucketName) => {
    try {
      const res = await axios.get(`${BASE_URL}/buckets/${bucketName}/objects`);
      const objects = res.data.objects;

      if (objects.length === 0) {
        console.log(chalk.yellow(`No files in bucket "${bucketName}"`));
        return;
      }

      console.log(chalk.cyan(`\n🗂️  Files in "${bucketName}":`));
      objects.forEach(obj => {
        console.log(chalk.white(`   • ${obj.key}`));
      });
      console.log('');
    } catch (err) {
      console.log(chalk.red('❌ Error:'), err.response?.data?.error || err.message);
    }
  });

// DOWNLOAD file
program
  .command('download <bucket> <key>')
  .description('Download a file from a bucket')
  .action(async (bucketName, key) => {
    try {
      console.log(chalk.gray(`⬇️  Downloading "${key}" from "${bucketName}"...`));

      const res = await axios.get(
        `${BASE_URL}/buckets/${bucketName}/objects/${key}`,
        { responseType: 'arraybuffer' } // get raw bytes
      );

      // Save to current directory
      const outputPath = path.join(process.cwd(), key);
      fs.writeFileSync(outputPath, res.data);

      console.log(chalk.green('✅ Downloaded!'));
      console.log(chalk.cyan(`   Saved to: ${outputPath}`));
    } catch (err) {
      console.log(chalk.red('❌ Error:'), err.response?.data?.error || err.message);
    }
  });

// DELETE object
program
  .command('delete-object <bucket> <key>')
  .description('Delete a file from a bucket')
  .action(async (bucketName, key) => {
    try {
      await axios.delete(`${BASE_URL}/buckets/${bucketName}/objects/${key}`);
      console.log(chalk.green(`✅ Deleted "${key}" from "${bucketName}"`));
    } catch (err) {
      console.log(chalk.red('❌ Error:'), err.response?.data?.error || err.message);
    }
  });

// Parse the command the user typed
program.parse(process.argv);