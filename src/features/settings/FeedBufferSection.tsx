import { SegmentedControl } from './SegmentedControl';
import { SettingsRow } from './SettingsRow';
import { SettingsSection } from './SettingsSection';
import { FEED_BUFFER_OPTIONS, useSettingsStore, type FeedBuffer } from './settingsStore';

interface BufferRowProps {
  label: string;
  value: FeedBuffer;
  onChange: (value: FeedBuffer) => void;
  testIDPrefix: string;
}

function BufferRow({ label, value, onChange, testIDPrefix }: BufferRowProps) {
  return (
    <SettingsRow
      label={label}
      description="Posts loaded ahead in the full-screen viewer"
      trailing={
        <SegmentedControl
          options={FEED_BUFFER_OPTIONS}
          value={value}
          onChange={onChange}
          label={`${label} buffer size`}
          optionLabel={(option) => `${option} posts`}
          testIDPrefix={testIDPrefix}
          compact
        />
      }
      testID={`row-${testIDPrefix}`}
    />
  );
}

/**
 * Settings → Feed buffer (DESIGN §3.8): how many posts the Dashboard and For You feeds keep
 * loaded ahead of the one shown full screen. Larger values mean more swiping before a wait,
 * at the cost of more data and API calls.
 */
export function FeedBufferSection() {
  const dashboard = useSettingsStore((s) => s.dashboardBuffer);
  const setDashboard = useSettingsStore((s) => s.setDashboardBuffer);
  const forYou = useSettingsStore((s) => s.forYouBuffer);
  const setForYou = useSettingsStore((s) => s.setForYouBuffer);
  return (
    <SettingsSection title="Feed buffer" testID="section-feed-buffer">
      <BufferRow
        label="Dashboard"
        value={dashboard}
        onChange={setDashboard}
        testIDPrefix="dashboard-buffer"
      />
      <BufferRow
        label="For You"
        value={forYou}
        onChange={setForYou}
        testIDPrefix="for-you-buffer"
      />
    </SettingsSection>
  );
}
