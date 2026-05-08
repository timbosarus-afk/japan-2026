// api/deploy.js — Vercel serverless function
// Reads new App.jsx from Supabase deployments table and commits to GitHub

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { secret, deployId, message } = req.body || {};
  if (secret !== process.env.DEPLOY_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!deployId) {
    return res.status(400).json({ error: 'deployId required' });
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

    const sbRes = await fetch(
      `${supabaseUrl}/rest/v1/deployments?id=eq.${deployId}&select=content`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    );
    const sbData = await sbRes.json();
    if (!sbData?.[0]?.content) {
      return res.status(404).json({ error: 'Deploy content not found in Supabase' });
    }
    const newContent = sbData[0].content;

    const ghToken = process.env.GITHUB_TOKEN;
    const owner = 'timbosarus-afk';
    const repo = 'japan-2026';
    const path = 'src/App.jsx';

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
      return res.status(500).json({ error: 'Could not get current file SHA', detail: shaData });
    }

    const encoded = Buffer.from(newContent, 'utf-8').toString('base64');
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
      await fetch(
        `${supabaseUrl}/rest/v1/deployments?id=eq.${deployId}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          }
        }
      );
      return res.status(200).json({
        success: true,
        commitSha: commitData.commit.sha,
        message: 'Deployed successfully — Vercel will rebuild in ~60s'
      });
    } else {
      return res.status(500).json({ error: 'GitHub commit failed', detail: commitData });
    }

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
