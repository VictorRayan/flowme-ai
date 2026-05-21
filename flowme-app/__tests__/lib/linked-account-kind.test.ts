import { isCalendarLinkedAccountName, isConnectorLinkedAccountName } from '@/lib/google/linked-account-kind';

describe('linked account kind helpers', () => {
  it('identifies connector-created linked accounts by generated connector names', () => {
    expect(isConnectorLinkedAccountName('Google Sheets (google sheets)')).toBe(true);
    expect(isConnectorLinkedAccountName('Google Docs (google docs)')).toBe(true);
    expect(isConnectorLinkedAccountName('My gmail (gmail)')).toBe(true);
    expect(isCalendarLinkedAccountName('victor@example.com')).toBe(true);
    expect(isCalendarLinkedAccountName('Work')).toBe(true);
  });
});
