import { DateTime } from 'luxon';

interface StatusProps {
	lastChecked?: Date | null;
	lastSynced?: Date | null;
}

export function Status({ lastChecked, lastSynced }: StatusProps) {
	return (
		<div className="status">
			<div className="status-timestamps">
				{lastChecked && (
					<span className="last-checked">
						Zuletzt aktualisiert&nbsp;
						{DateTime.fromJSDate(lastChecked).toRelative({
							locale: 'de',
						})}
						.
					</span>
				)}
				{lastSynced && (
					<span className="last-synced">
						Zuletzt synchronisiert&nbsp;
						{DateTime.fromJSDate(lastSynced).toRelative({
							locale: 'de',
						})}
						.
					</span>
				)}
			</div>

			{/* biome-ignore lint/a11y/useValidAnchor: refresh handled in scripts.js */}
			<a id="refresh-book-availability">Aktualisieren</a>
		</div>
	);
}
