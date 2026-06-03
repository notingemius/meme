// Роль матчу, з якою відкривається ігровий екран.
export type MatchRoleParam =
  | { mode: 'bots' }
  | { mode: 'wifi-host' }
  | { mode: 'wifi-join'; host: string };

export type RootStackParamList = {
  Menu: undefined;
  WifiSetup: { nickname: string };
  Play: { nickname: string; role?: MatchRoleParam };
};
