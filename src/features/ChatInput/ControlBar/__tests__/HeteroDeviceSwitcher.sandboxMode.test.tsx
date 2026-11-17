import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HeteroDeviceSwitcher from '../HeteroDeviceSwitcher';

const state = vi.hoisted(() => ({
  agencyConfig: { executionTarget: 'sandbox' } as Record<string, unknown>,
  agentMap: {} as Record<string, object>,
  devices: [] as object[],
  driveStatus: 'ready' as 'hidden' | 'loading' | 'ready' | 'upgrade',
  openUpsell: vi.fn(),
  persistent: false,
  selectTarget: vi.fn(),
  toPersistent: vi.fn(),
  toTemporary: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// The menu, open: which rows it offers and what they do is the question. The
// sandbox submenu is a popover too, so the first `chip` is the composer's.
vi.mock('@lobehub/ui', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  Popover: ({ children, content }: { children: ReactNode; content: ReactNode }) => (
    <div>
      <div data-testid="chip">{children}</div>
      {content}
    </div>
  ),
}));

vi.mock('@lobechat/const', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isDesktop: false,
}));

vi.mock('@/business/client/features/SandboxStorageUpsell', () => ({
  openSandboxStorageUpsell: state.openUpsell,
}));
vi.mock('@/features/ChatInput/hooks/useChatInputResourceAccess', () => ({
  useChatInputResourceAccess: () => ({ canUseResource: true }),
}));
vi.mock('@/features/ChatInput/hooks/useLocalSandboxCapability', () => ({
  useLocalSandboxCapability: () => ({ data: undefined, mutate: vi.fn() }),
}));
vi.mock('@/features/ChatInput/hooks/useSelectExecutionTarget', () => ({
  useSelectExecutionTarget: () => vi.fn(),
}));
vi.mock('@/features/DeviceManager/DeviceLoadMeter', () => ({
  default: () => null,
  useDeviceLoad: () => null,
}));
vi.mock('@/features/Workspace/useWorkspaceAwareNavigate', () => ({
  useWorkspaceAwareNavigate: () => vi.fn(),
}));
vi.mock('@/helpers/gatewayMode', () => ({ useIsGatewayModeEnabled: () => false }));
vi.mock('@/hooks/useEffectiveAgencyConfig', () => ({
  useEffectiveAgencyConfig: () => ({
    agencyConfig: state.agencyConfig,
    canDisplayExecutionTarget: true,
    canSelectExecutionTarget: true,
    isPreferenceLoading: false,
    topicDeviceUnknown: false,
    workspaceScoped: false,
  }),
}));
vi.mock('@/hooks/useLocalMachineDeviceIds', () => ({ useLocalMachineDeviceIds: () => [] }));
vi.mock('@/services/device', () => ({ deviceService: {} }));
vi.mock('@/services/electron/localFileService', () => ({ localFileService: {} }));
vi.mock('@/store/agent', () => ({
  useAgentStore: (selector: (s: object) => unknown) => selector({ agentMap: state.agentMap }),
}));
vi.mock('@/store/device', () => ({
  isDevicePresenceUnknown: () => false,
  useDeviceList: () => ({
    data: state.devices,
    error: undefined,
    isConfirmed: true,
    isValidating: false,
    mutate: vi.fn(),
  }),
}));
vi.mock('@/store/electron', () => ({
  useElectronStore: (selector: (s: object) => unknown) =>
    selector({ gatewayDeviceInfo: undefined, useFetchGatewayDeviceInfo: () => () => undefined }),
}));
vi.mock('../../hooks/useTopicId', () => ({ useTopicId: () => 'topic-1' }));
// A machine is one clickable row here; DeviceOptionRow has tests of its own.
vi.mock('../DeviceOptionRow', () => ({
  default: ({ device, onSelect }: { device: { hostname: string }; onSelect: () => void }) => (
    <div onClick={onSelect}>{device.hostname}</div>
  ),
}));
vi.mock('../useSandboxNetworkToggle', () => ({ useSandboxNetworkToggle: () => vi.fn() }));
vi.mock('../useTopicAwareTargetSelect', () => ({
  useTopicAwareTargetSelect: () => ({ selectTarget: state.selectTarget, topicDeviceId: undefined }),
}));
vi.mock('../useSandboxModeSelect', () => ({
  useSandboxModeSelect: () => ({
    driveStatus: state.driveStatus,
    persistent: state.persistent,
    toPersistent: state.toPersistent,
    toTemporary: state.toTemporary,
  }),
}));

const SANDBOX = 'heteroAgent.executionTarget.sandbox';
const TEMPORARY = 'heteroAgent.executionTarget.temporarySandbox';
const PERSISTENT = 'heteroAgent.executionTarget.persistentSandbox';

beforeEach(() => {
  state.agencyConfig = { executionTarget: 'sandbox' };
  state.agentMap = {};
  state.devices = [];
  state.driveStatus = 'ready';
  state.persistent = false;
  state.openUpsell.mockReset();
  state.selectTarget.mockReset().mockImplementation(async (...args: unknown[]) => {
    const afterApply = args[3] as (() => Promise<void>) | undefined;
    await afterApply?.();
  });
  state.toPersistent.mockReset().mockResolvedValue(undefined);
  state.toTemporary.mockReset().mockResolvedValue(undefined);
});

// T-14161: the persistent sandbox is a row of its own in the execution
// environment, not a folder picked after "Cloud sandbox".
describe('HeteroDeviceSwitcher — persistent sandbox', () => {
  it('offers the persistent sandbox next to the temporary one', () => {
    render(<HeteroDeviceSwitcher agentId="agent-1" />);

    expect(screen.getAllByText(TEMPORARY).length).toBeGreaterThan(0);
    expect(screen.getByText('heteroAgent.executionTarget.persistentSandboxDesc')).toBeTruthy();
  });

  // Next to the persistent sandbox, the plain one is called the temporary
  // sandbox, on its row and on the chip.
  it('names the plain sandbox temporary next to the persistent one', () => {
    render(<HeteroDeviceSwitcher agentId="agent-1" />);

    expect(screen.getAllByTestId('chip')[0].textContent).toContain(TEMPORARY);
    // "Cloud sandbox" is left to the first-level row the two sandboxes sit under.
    const submenu = screen.getByTestId('execution-group-sandbox').parentElement!;
    expect(submenu.textContent).toContain(TEMPORARY);
  });

  // The persistent sandbox is where everyday work belongs, so it comes first;
  // the temporary one is described as the place for coding and one-off work.
  it('lists the persistent sandbox above the temporary one', () => {
    render(<HeteroDeviceSwitcher agentId="agent-1" />);

    const persistent = screen.getByText('heteroAgent.executionTarget.persistentSandboxDesc');
    const temporary = screen.getByText('heteroAgent.executionTarget.temporarySandboxDesc');

    expect(
      persistent.compareDocumentPosition(temporary) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByText('heteroAgent.executionTarget.sandboxDesc')).toBeNull();
  });

  it('describes the cloud sandbox as before where there is no drive at all', () => {
    state.driveStatus = 'hidden';
    render(<HeteroDeviceSwitcher agentId="agent-1" />);

    expect(screen.getByText('heteroAgent.executionTarget.sandboxDesc')).toBeTruthy();
    expect(screen.queryByText('heteroAgent.executionTarget.temporarySandboxDesc')).toBeNull();
    expect(screen.getAllByText(SANDBOX).length).toBeGreaterThan(0);
    expect(screen.queryByText(TEMPORARY)).toBeNull();
  });

  it('names the persistent sandbox on the chip when the conversation keeps its files', () => {
    state.persistent = true;
    render(<HeteroDeviceSwitcher agentId="agent-1" />);

    expect(screen.getAllByTestId('chip')[0].textContent).toContain(PERSISTENT);
  });

  it('switches to the sandbox and onto the drive when the persistent row is picked', async () => {
    render(<HeteroDeviceSwitcher agentId="agent-1" />);

    fireEvent.click(screen.getByText('heteroAgent.executionTarget.persistentSandboxDesc'));
    await vi.waitFor(() => expect(state.toPersistent).toHaveBeenCalledTimes(1));

    expect(state.selectTarget.mock.calls[0][0]).toBe('sandbox');
    expect(state.toTemporary).not.toHaveBeenCalled();
  });

  it('switches to the temporary sandbox from the plain row', async () => {
    state.persistent = true;
    render(<HeteroDeviceSwitcher agentId="agent-1" />);

    fireEvent.click(screen.getByText('heteroAgent.executionTarget.temporarySandboxDesc'));
    await vi.waitFor(() => expect(state.toTemporary).toHaveBeenCalledTimes(1));

    expect(state.selectTarget.mock.calls[0][0]).toBe('sandbox');
    expect(state.toPersistent).not.toHaveBeenCalled();
  });

  it('shows a plan without a drive the way to one instead', () => {
    state.driveStatus = 'upgrade';
    render(<HeteroDeviceSwitcher agentId="agent-1" />);

    fireEvent.click(screen.getByText('heteroAgent.executionTarget.persistentSandboxDesc'));

    expect(screen.getByText('pro')).toBeTruthy();
    expect(state.openUpsell).toHaveBeenCalledTimes(1);
    expect(state.selectTarget).not.toHaveBeenCalled();
  });

  it.each(['hidden', 'loading'] as const)('hides the row while the drive is %s', (driveStatus) => {
    state.driveStatus = driveStatus;
    render(<HeteroDeviceSwitcher agentId="agent-1" />);

    expect(screen.queryByText(PERSISTENT)).toBeNull();
  });
});

// T-14358: the first level is exactly the four kinds of execution target —
// Auto, Sandbox ›, Devices ›, No device — and every concrete choice (this
// computer, the persistent / temporary sandbox, each machine, the private /
// workspace pools) sits one level down.
describe('HeteroDeviceSwitcher — four first-level rows', () => {
  const firstLevel = () => {
    const menu = screen.getByTestId('execution-target-menu');
    // The header, then one entry per kind of execution target.
    return [...menu.children].slice(1);
  };
  // A group's popover renders its row (the `chip` slot of the mock) and then
  // its submenu; the row alone is the first level.
  const row = (testId: string) => screen.getByTestId(testId);
  const submenu = (testId: string) => row(testId).closest('[data-testid="chip"]')!.parentElement!;
  // What the first level shows by itself: each entry minus any submenu.
  const firstLevelText = () =>
    firstLevel()
      .map((entry) => {
        const chip = entry.querySelector('[data-testid="chip"]');
        return (chip ?? entry).textContent;
      })
      .join('|');

  beforeEach(() => {
    state.devices = [
      {
        channels: [],
        deviceId: 'd1',
        hostname: 'build-host-7',
        online: true,
        platform: 'linux',
        scope: 'personal',
      },
    ];
  });

  it('shows exactly auto, sandbox, devices and no device, in order', () => {
    render(<HeteroDeviceSwitcher agentId="agent-1" />);

    const entries = firstLevel();
    expect(entries).toHaveLength(4);
    expect(entries[0].getAttribute('data-testid')).toBe('execution-option-auto');
    expect(entries[0].textContent).toBe('heteroAgent.executionTarget.auto');
    expect(entries[1].querySelector('[data-testid="execution-group-sandbox"]')).toBeTruthy();
    expect(entries[1].textContent).toContain('heteroAgent.executionTarget.sandboxGroup');
    expect(entries[2].querySelector('[data-testid="execution-group-devices"]')).toBeTruthy();
    expect(entries[2].textContent).toContain('heteroAgent.executionTarget.devicesGroup');
    expect(entries[3].getAttribute('data-testid')).toBe('execution-option-none');
    expect(entries[3].textContent).toBe('heteroAgent.executionTarget.none');
  });

  it('has no this-computer row on the first level', () => {
    render(<HeteroDeviceSwitcher agentId="agent-1" />);

    expect(screen.queryByTestId('execution-group-local')).toBeNull();
    expect(screen.queryByText('heteroAgent.executionTarget.builtinGroup')).toBeNull();
  });

  it('keeps every concrete choice off the first level', () => {
    // Nothing in use, so no group row names a pick of its own.
    state.agencyConfig = { executionTarget: 'none' };
    render(<HeteroDeviceSwitcher agentId="agent-1" />);

    const text = firstLevelText();
    for (const detail of [
      'heteroAgent.executionTarget.local',
      PERSISTENT,
      TEMPORARY,
      'heteroAgent.executionTarget.personalGroup',
      'heteroAgent.executionTarget.workspaceGroup',
      'build-host-7',
      'Desc',
      'download',
    ])
      expect(text).not.toContain(detail);
  });

  it('puts this computer first under devices, then the machines', () => {
    render(<HeteroDeviceSwitcher agentId="agent-1" />);

    const devices = submenu('execution-group-devices');
    // Web has no computer to run on in-process: this computer is the
    // desktop app's download card.
    const card = devices.querySelector('[data-testid="download-desktop-card"]')!;
    expect(card).toBeTruthy();
    const host = screen.getByText('build-host-7');
    expect(card.compareDocumentPosition(host) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(devices.textContent).not.toContain('heteroAgent.executionTarget.autoDesc');
  });

  it('keeps the online count on the devices row', () => {
    render(<HeteroDeviceSwitcher agentId="agent-1" />);

    expect(row('execution-group-devices').textContent).toContain(
      'heteroAgent.executionTarget.deviceGroupSummary',
    );
  });

  it('puts both cloud sandboxes under sandbox', () => {
    render(<HeteroDeviceSwitcher agentId="agent-1" />);

    const sandbox = submenu('execution-group-sandbox');
    expect(sandbox.textContent).toContain(PERSISTENT);
    expect(sandbox.textContent).toContain(TEMPORARY);
    // The local sandbox is desktop-only.
    expect(sandbox.textContent).not.toContain('heteroAgent.executionTarget.localSandbox');
  });

  it('picks auto straight from the first level', async () => {
    render(<HeteroDeviceSwitcher agentId="agent-1" />);

    fireEvent.click(screen.getByTestId('execution-option-auto'));
    await vi.waitFor(() => expect(state.selectTarget).toHaveBeenCalledTimes(1));
    expect(state.selectTarget.mock.calls[0][0]).toBe('auto');
  });

  it('picks no device straight from the first level', async () => {
    render(<HeteroDeviceSwitcher agentId="agent-1" />);

    fireEvent.click(screen.getByTestId('execution-option-none'));
    await vi.waitFor(() => expect(state.selectTarget).toHaveBeenCalledTimes(1));
    expect(state.selectTarget.mock.calls[0][0]).toBe('none');
  });

  it('picks a machine from the devices submenu', async () => {
    render(<HeteroDeviceSwitcher agentId="agent-1" />);

    fireEvent.click(screen.getByText('build-host-7'));
    await vi.waitFor(() => expect(state.selectTarget).toHaveBeenCalledTimes(1));
    expect(state.selectTarget.mock.calls[0].slice(0, 2)).toEqual(['device', 'd1']);
  });

  it('names the sandbox in use on its row', () => {
    state.persistent = true;
    render(<HeteroDeviceSwitcher agentId="agent-1" />);

    expect(row('execution-group-sandbox').textContent).toContain(PERSISTENT);
  });

  it('names the device in use on the devices row', () => {
    state.agencyConfig = { boundDeviceId: 'd1', executionTarget: 'device' };
    render(<HeteroDeviceSwitcher agentId="agent-1" />);

    expect(row('execution-group-devices').textContent).toContain('build-host-7');
    expect(row('execution-group-sandbox').textContent).not.toContain(TEMPORARY);
  });

  it('marks auto in use on its own row, not under devices', () => {
    state.agencyConfig = { executionTarget: 'auto' };
    render(<HeteroDeviceSwitcher agentId="agent-1" />);

    expect(row('execution-group-devices').textContent).not.toContain(
      'heteroAgent.executionTarget.auto',
    );
  });

  it("splits a workspace agent's machines into private and workspace under devices", () => {
    state.agentMap = { 'agent-1': { workspaceId: 'ws-1' } };
    state.devices = [
      {
        channels: [],
        deviceId: 'w1',
        hostname: 'shared-runner',
        online: true,
        platform: 'linux',
        scope: 'workspace',
        visibility: 'workspace',
      },
    ];
    render(<HeteroDeviceSwitcher agentId="agent-1" />);

    const devices = submenu('execution-group-devices');
    expect(devices.textContent).toContain('heteroAgent.executionTarget.personalGroup');
    expect(devices.textContent).toContain('heteroAgent.executionTarget.workspaceGroup');
    expect(devices.textContent).toContain('shared-runner');
    expect(firstLevel()).toHaveLength(4);
    expect(firstLevelText()).not.toContain('heteroAgent.executionTarget.personalGroup');
    expect(firstLevelText()).not.toContain('heteroAgent.executionTarget.workspaceGroup');
  });

  // A CLI agent must run somewhere and names where: no auto, no "no device".
  it('shows only sandbox and devices for a heterogeneous agent', () => {
    state.agencyConfig = { executionTarget: 'sandbox', heterogeneousProvider: { type: 'codex' } };
    render(<HeteroDeviceSwitcher agentId="agent-1" />);

    const entries = firstLevel();
    expect(entries).toHaveLength(2);
    expect(entries[0].querySelector('[data-testid="execution-group-sandbox"]')).toBeTruthy();
    expect(entries[1].querySelector('[data-testid="execution-group-devices"]')).toBeTruthy();
    expect(screen.queryByTestId('execution-option-auto')).toBeNull();
    expect(screen.queryByTestId('execution-option-none')).toBeNull();
  });
});
