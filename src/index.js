'use strict';

const core = require('@actions/core');
const github = require('@actions/github');
const { buildPattern, validateSubject } = require('./validate');

async function getCommits(octokit, context) {
  if (context.eventName === 'pull_request' || context.eventName === 'pull_request_target') {
    const { data } = await octokit.rest.pulls.listCommits({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: context.payload.pull_request.number,
      per_page: 100,
    });
    return data.map(c => ({
      sha: c.sha,
      subject: c.commit.message.split('\n')[0].trim(),
      url: c.html_url,
    }));
  }

  if (context.eventName === 'push') {
    return (context.payload.commits || []).map(c => ({
      sha: c.id,
      subject: c.message.split('\n')[0].trim(),
      url: c.url,
    }));
  }

  return null;
}

function buildFailureComment(failing, types) {
  const rows = failing
    .map(c => `| [\`${c.sha.slice(0, 7)}\`](${c.url}) | \`${c.subject}\` |`)
    .join('\n');

  return [
    '## ❌ Conventional Commit Violations',
    '',
    `**${failing.length} commit(s)** do not follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.`,
    '',
    '| Commit | Message |',
    '|--------|---------|',
    rows,
    '',
    '### Expected format',
    '```',
    'type(scope): description',
    '```',
    '',
    `**Allowed types:** ${types.map(t => `\`${t}\``).join(', ')}`,
    '',
    '### Valid examples',
    '```',
    'feat: add user login',
    'fix(auth): handle expired tokens',
    'chore!: drop support for Node 16   ← breaking change',
    'docs(readme): update installation steps',
    '```',
    '',
    '> 💡 Need help? See the [Conventional Commits spec](https://www.conventionalcommits.org/en/v1.0.0/).',
  ].join('\n');
}

async function run() {
  try {
    const token = core.getInput('token', { required: true });
    const typesRaw = core.getInput('types') || 'feat,fix,chore,docs,style,refactor,perf,test,build,ci,revert';
    const requireScope = core.getInput('require-scope') === 'true';
    const scopePattern = core.getInput('scope-pattern') || '[a-zA-Z0-9_.\\-]+';
    const ignoreMerge = core.getInput('ignore-merge-commits') !== 'false';
    const postComment = core.getInput('post-comment') !== 'false';

    const types = typesRaw.split(',').map(t => t.trim()).filter(Boolean);
    const pattern = buildPattern(types, requireScope, scopePattern);

    const octokit = github.getOctokit(token);
    const context = github.context;

    const commits = await getCommits(octokit, context);

    if (commits === null) {
      core.warning(`Unsupported event type: "${context.eventName}". Supported: pull_request, push.`);
      return;
    }

    if (commits.length === 0) {
      core.info('No commits to validate.');
      core.setOutput('valid', 'true');
      core.setOutput('failing-commits', '');
      return;
    }

    const failing = [];
    const passing = [];

    for (const commit of commits) {
      const { valid, skipped } = validateSubject(commit.subject, pattern, ignoreMerge);

      if (skipped) {
        core.info(`⏭️  ${commit.sha.slice(0, 7)} — skipped (merge commit)`);
        continue;
      }

      if (valid) {
        passing.push(commit);
        core.info(`✅ ${commit.sha.slice(0, 7)} — ${commit.subject}`);
      } else {
        failing.push(commit);
        core.error(`❌ ${commit.sha.slice(0, 7)} — ${commit.subject}`);
      }
    }

    core.setOutput('valid', failing.length === 0 ? 'true' : 'false');
    core.setOutput('failing-commits', failing.map(c => c.sha).join('\n'));

    if (failing.length === 0) {
      core.info(`\n✅ All ${passing.length} commit(s) follow Conventional Commits.`);
      return;
    }

    const commentBody = buildFailureComment(failing, types);

    await core.summary
      .addRaw(commentBody)
      .write();

    if (postComment && context.eventName.startsWith('pull_request')) {
      try {
        await octokit.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: context.payload.pull_request.number,
          body: commentBody,
        });
      } catch (err) {
        core.warning(`Could not post PR comment: ${err.message}`);
      }
    }

    core.setFailed(
      `${failing.length} commit(s) violate the Conventional Commits specification. See the job summary for details.`
    );
  } catch (err) {
    core.setFailed(`Action failed with error: ${err.message}`);
  }
}

run();
