import React, { useState } from 'react';

export type Quest = {
  id: string;
  type: string;
  title: string;
  target: number;
  rewardXp: number;
  rewardCoins: number;
  active: boolean;
};

export type Badge = {
  id: string;
  code: string;
  name: string;
  category: string;
  iconUrl: string;
  criteria: string;
};

type Props = {
  quests: Quest[];
  badges: Badge[];
  saveQuest: (quest: Quest) => Promise<void>;
  saveBadge: (badge: Badge) => Promise<void>;
  uploadIcon: (file: File) => Promise<string>;
};

const emptyQuest: Quest = {
  id: '', type: 'lesson', title: '', target: 1,
  rewardXp: 0, rewardCoins: 0, active: true,
};

const emptyBadge: Badge = {
  id: '', code: '', name: '', category: 'achievement',
  iconUrl: '', criteria: '{}',
};

export default function QuestsBadgesStudioPage({
  quests,
  badges,
  saveQuest,
  saveBadge,
  uploadIcon,
}: Props) {
  const [quest, setQuest] = useState<Quest | null>(null);
  const [badge, setBadge] = useState<Badge | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submitQuest(event: React.FormEvent) {
    event.preventDefault();
    if (!quest) return;

    setBusy(true);
    try {
      await saveQuest(quest);
      setQuest(null);
      setMessage('Quest template saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save quest.');
    } finally {
      setBusy(false);
    }
  }

  async function submitBadge(event: React.FormEvent) {
    event.preventDefault();
    if (!badge) return;

    try {
      JSON.parse(badge.criteria);
    } catch {
      setMessage('Criteria must be valid JSON.');
      return;
    }

    setBusy(true);
    try {
      await saveBadge(badge);
      setBadge(null);
      setMessage('Badge definition saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save badge.');
    } finally {
      setBusy(false);
    }
  }

  async function uploadBadgeIcon(file?: File) {
    if (!file || !badge) return;

    try {
      const iconUrl = await uploadIcon(file);
      setBadge({ ...badge, iconUrl });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Icon upload failed.');
    }
  }

  return (
    <main style={{ maxWidth: 1050, margin: '2rem auto', fontFamily: 'system-ui' }}>
      <h1>Quests &amp; Badges Studio</h1>

      <section>
        <h2>Quest templates</h2>
        <button onClick={() => setQuest({ ...emptyQuest })}>Create quest</button>

        <table style={{ width: '100%' }}>
          <thead>
            <tr>
              <th align="left">Title</th>
              <th>Type</th>
              <th>Target</th>
              <th>Rewards</th>
              <th>Active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {quests.map(item => (
              <tr key={item.id}>
                <td>{item.title}</td>
                <td>{item.type}</td>
                <td>{item.target}</td>
                <td>{item.rewardXp} XP / {item.rewardCoins} coins</td>
                <td>{item.active ? 'Yes' : 'No'}</td>
                <td><button onClick={() => setQuest({ ...item })}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Badge definitions</h2>
        <button onClick={() => setBadge({ ...emptyBadge })}>Create badge</button>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {badges.map(item => (
            <button
              key={item.id}
              onClick={() => setBadge({ ...item })}
              style={{
                border: '3px solid #24204b',
                padding: 16,
                background: '#fff7d6',
                boxShadow: '4px 4px #6d50a1',
              }}
            >
              {item.iconUrl && <img src={item.iconUrl} alt="" width="44" height="44" />}
              <strong style={{ display: 'block' }}>{item.name}</strong>
              {item.code}
            </button>
          ))}
        </div>
      </section>

      {quest && (
        <div role="dialog" aria-modal="true" style={dialogStyle}>
          <form onSubmit={submitQuest} style={formStyle}>
            <h2>Quest template</h2>
            <label>
              Type{' '}
              <select value={quest.type} onChange={event => setQuest({ ...quest, type: event.target.value })}>
                <option>lesson</option><option>quiz</option><option>streak</option><option>practice</option>
              </select>
            </label>
            <p><label>Title <input required value={quest.title} onChange={event => setQuest({ ...quest, title: event.target.value })} /></label></p>
            <p><label>Target count <input type="number" min="1" value={quest.target} onChange={event => setQuest({ ...quest, target: Number(event.target.value) })} /></label></p>
            <p><label>Reward XP <input type="number" min="0" value={quest.rewardXp} onChange={event => setQuest({ ...quest, rewardXp: Number(event.target.value) })} /></label></p>
            <p><label>Reward coins <input type="number" min="0" value={quest.rewardCoins} onChange={event => setQuest({ ...quest, rewardCoins: Number(event.target.value) })} /></label></p>
            <label><input type="checkbox" checked={quest.active} onChange={event => setQuest({ ...quest, active: event.target.checked })} /> Active</label>
            <p>
              <button disabled={busy}>Save quest</button>{' '}
              <button type="button" onClick={() => setQuest(null)}>Cancel</button>
            </p>
          </form>
        </div>
      )}

      {badge && (
        <div role="dialog" aria-modal="true" style={dialogStyle}>
          <form onSubmit={submitBadge} style={formStyle}>
            <h2>Badge definition</h2>
            <p><label>Badge code <input required value={badge.code} onChange={event => setBadge({ ...badge, code: event.target.value })} /></label></p>
            <p><label>Name <input required value={badge.name} onChange={event => setBadge({ ...badge, name: event.target.value })} /></label></p>
            <p><label>Category <input required value={badge.category} onChange={event => setBadge({ ...badge, category: event.target.value })} /></label></p>
            <p>
              <label>Icon upload <input type="file" accept="image/*" onChange={event => void uploadBadgeIcon(event.target.files?.[0])} /></label>
              {badge.iconUrl && <img src={badge.iconUrl} alt="Badge preview" width="56" />}
            </p>
            <p>
              <label>
                Criteria JSON (example: {"{\"streak_days\":{\"gte\":30}}"})
                <textarea
                  rows={5}
                  style={{ display: 'block', width: '100%' }}
                  value={badge.criteria}
                  onChange={event => setBadge({ ...badge, criteria: event.target.value })}
                />
              </label>
            </p>
            <button disabled={busy}>Save badge</button>{' '}
            <button type="button" onClick={() => setBadge(null)}>Cancel</button>
          </form>
        </div>
      )}

      <p role="status">{message}</p>
    </main>
  );
}

const dialogStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: '#0008',
  display: 'grid',
  placeItems: 'center',
};

const formStyle: React.CSSProperties = {
  background: 'white',
  padding: 24,
  borderRadius: 12,
  width: 'min(560px, 92vw)',
};
