// api/deploy.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { secret, message } = req.body || {};
  if (secret !== process.env.DEPLOY_SECRET) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // 1. Read new App.jsx from Supabase
    const sbRes = await fetch(
      `${process.env.VITE_SUPABASE_URL}/rest/v1/deployments?id=eq.app-deploy-latest&select=content`,
      { headers: { 'apikey': process.env.VITE_SUPABASE_ANON_KEY, 'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}` } }
    );
    const sbData = await sbRes.json();
    const content = sbData?.[0]?.content;
    if (!content) return res.status(404).json({ error: 'No pending deployment found in Supabase' });

    // 2. Get current SHA from GitHub
    const ghHeaders = { 'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' };
    const shaRes = await fetch('https://api.github.com/repos/timbosarus-afk/japan-2026/contents/src/App.jsx', { headers: ghHeaders });
    const shaData = await shaRes.json();
    if (!shaData.sha) return res.status(500).json({ error: 'Could not get SHA', detail: shaData });

    // 3. Commit to GitHub
    const encoded = Buffer.from(content, 'utf-8').toString('base64');
    const commitRes = await fetch('https://api.github.com/repos/timbosarus-afk/japan-2026/contents/src/App.jsx', {
      method: 'PUT',
      headers: { ...ghHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message || 'Deploy via Claude', content: encoded, sha: shaData.sha, branch: 'main' })
    });
    const commitData = await commitRes.json();

    if (commitData.commit?.sha) {
      // 4. Clean up Supabase
      await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/deployments?id=eq.app-deploy-latest`, {
        method: 'DELETE',
        headers: { 'apikey': process.env.VITE_SUPABASE_ANON_KEY, 'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}` }
      });
      return res.status(200).json({ success: true, commitSha: commitData.commit.sha });
    } else {
      return res.status(500).json({ error: 'Commit failed', detail: commitData });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
