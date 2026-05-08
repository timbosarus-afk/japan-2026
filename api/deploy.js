// api/deploy.js — Vercel serverless function
// Writes App.jsx directly via GitHub API using stored token

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { secret, content, message } = req.body || {};

  if (secret !== process.env.DEPLOY_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!content) {
    return res.status(400).json({ error: 'content required' });
  }

  try {
    const ghToken = process.env.GITHUB_TOKEN;
    const owner = 'timbosarus-afk';
    const repo = 'japan-2026';
    const path = 'src/App.jsx';

    // Get current SHA
    const shaRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        headers: {
          'Authorization': `Bearer ${ghToken}`,
          'Accept': 'application/vnd.github.v3+json',
        }
      }
    );
    const shaData = await shaRes.json();
    const currentSha = shaData.sha;

    if (!currentSha) {
      return res.status(500).json({ error: 'Could not get SHA', detail: shaData });
    }

    // Commit new content
    const encoded = Buffer.from(content, 'utf-8').toString('base64');
    const commitRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${ghToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message || 'Deploy via Claude',
          content: encoded,
          sha: currentSha,
          branch: 'main',
        })
      }
    );

    const commitData = await commitRes.json();

    if (commitData.commit?.sha) {
      return res.status(200).json({
        success: true,
        commitSha: commitData.commit.sha,
        message: 'Deployed — Vercel rebuilding in ~60s'
      });
    } else {
      return res.status(500).json({ error: 'Commit failed', detail: commitData });
    }

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
