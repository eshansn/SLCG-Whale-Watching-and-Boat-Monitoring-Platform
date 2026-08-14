import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../widgets/shore_layout.dart';
import 'shore_wildlife_common.dart';

class ShoreWildlifeSettingsScreen extends StatefulWidget {
  const ShoreWildlifeSettingsScreen({super.key});

  @override
  State<ShoreWildlifeSettingsScreen> createState() =>
      _ShoreWildlifeSettingsScreenState();
}

class _ShoreWildlifeSettingsScreenState
    extends State<ShoreWildlifeSettingsScreen> {
  bool _notifications = true;
  bool _autoUpdates = true;

  @override
  Widget build(BuildContext context) => ShoreLayout(
        portal: ShorePortal.wildlife,
        active: 'settings',
        child: LayoutBuilder(
          builder: (context, constraints) => ListView(
            padding: EdgeInsets.symmetric(
              horizontal: constraints.maxWidth >= 700 ? 24 : 16,
              vertical: constraints.maxWidth >= 700 ? 28 : 20,
            ),
            children: [
              Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 760),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const WildlifePageHeading(
                        title: 'Settings',
                        subtitle:
                            'Manage your Wildlife Shore portal preferences',
                        icon: Icons.settings_outlined,
                      ),
                      const SizedBox(height: 24),
                      WildlifeCard(
                        child: Column(
                          children: [
                            _toggle(
                              'App Notifications',
                              'Receive Wildlife Shore trip updates',
                              Icons.notifications_none_rounded,
                              _notifications,
                              (value) => setState(() => _notifications = value),
                            ),
                            const Divider(height: 30),
                            _toggle(
                              'Auto Updates',
                              'Refresh operational data automatically',
                              Icons.sync_rounded,
                              _autoUpdates,
                              (value) => setState(() => _autoUpdates = value),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      WildlifeCard(
                        child: Column(
                          children: [
                            _action(
                              'Password',
                              'Update your account password',
                              Icons.lock_outline_rounded,
                              _changePassword,
                            ),
                            const Divider(height: 30),
                            _action(
                              'Need Help?',
                              'View Wildlife Shore support information',
                              Icons.help_outline_rounded,
                              _showHelp,
                            ),
                            const Divider(height: 30),
                            _action(
                              'Log Out',
                              'Log out from the WWMS application',
                              Icons.logout_rounded,
                              _logout,
                              destructive: true,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      );

  Widget _toggle(
    String title,
    String subtitle,
    IconData icon,
    bool value,
    ValueChanged<bool> onChanged,
  ) =>
      Row(
        children: [
          _icon(icon),
          const SizedBox(width: 12),
          Expanded(child: _copy(title, subtitle)),
          Switch.adaptive(
            value: value,
            activeTrackColor: wildlifeGreen,
            onChanged: onChanged,
          ),
        ],
      );

  Widget _action(
    String title,
    String subtitle,
    IconData icon,
    VoidCallback onTap, {
    bool destructive = false,
  }) =>
      InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 2),
          child: Row(
            children: [
              _icon(icon, destructive: destructive),
              const SizedBox(width: 12),
              Expanded(child: _copy(title, subtitle, destructive: destructive)),
              Icon(Icons.chevron_right_rounded,
                  color: destructive ? Colors.red : const Color(0xFF64748B)),
            ],
          ),
        ),
      );

  Widget _icon(IconData icon, {bool destructive = false}) => Container(
        width: 42,
        height: 42,
        decoration: BoxDecoration(
          color: destructive ? const Color(0xFFFEF2F2) : wildlifeMint,
          borderRadius: BorderRadius.circular(13),
        ),
        child: Icon(icon,
            color: destructive ? const Color(0xFFDC2626) : wildlifeGreen,
            size: 21),
      );

  Widget _copy(String title, String subtitle, {bool destructive = false}) =>
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: destructive ? const Color(0xFFDC2626) : shoreInk)),
          const SizedBox(height: 3),
          Text(subtitle,
              style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
        ],
      );

  Future<void> _changePassword() async {
    final current = TextEditingController();
    final password = TextEditingController();
    final confirm = TextEditingController();
    String? error;
    bool saving = false;
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) {
          Future<void> submit() async {
            if (current.text.isEmpty) {
              setDialogState(() => error = 'Current password is required.');
              return;
            }
            if (password.text.length < 12) {
              setDialogState(() =>
                  error = 'New password must contain at least 12 characters.');
              return;
            }
            if (password.text != confirm.text) {
              setDialogState(() => error = 'New passwords do not match.');
              return;
            }
            setDialogState(() {
              saving = true;
              error = null;
            });
            try {
              await ApiService.instance
                  .changePassword(current.text, password.text);
              if (dialogContext.mounted) Navigator.pop(dialogContext);
              if (mounted) _message('Password updated successfully.');
            } catch (exception) {
              if (dialogContext.mounted) {
                setDialogState(() {
                  saving = false;
                  error = wildlifeError(exception);
                });
              }
            }
          }

          return AlertDialog(
            title: const Text('Change Password'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: current,
                  obscureText: true,
                  decoration:
                      const InputDecoration(labelText: 'Current password'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: password,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: 'New password'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: confirm,
                  obscureText: true,
                  decoration:
                      const InputDecoration(labelText: 'Confirm password'),
                ),
                if (error != null) ...[
                  const SizedBox(height: 10),
                  Text(error!,
                      style: const TextStyle(color: Color(0xFFDC2626))),
                ],
              ],
            ),
            actions: [
              TextButton(
                onPressed: saving ? null : () => Navigator.pop(context),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: saving ? null : submit,
                style: FilledButton.styleFrom(backgroundColor: wildlifeForest),
                child: Text(saving ? 'Updating...' : 'Update'),
              ),
            ],
          );
        },
      ),
    );
    current.dispose();
    password.dispose();
    confirm.dispose();
  }

  Future<void> _showHelp() => showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          icon: const Icon(Icons.support_agent_rounded,
              color: wildlifeGreen, size: 34),
          title: const Text('Wildlife Shore Support'),
          content: const Text(
            'Contact the WWMS support centre for account or trip-monitoring assistance.',
            textAlign: TextAlign.center,
          ),
          actions: [
            FilledButton(
              onPressed: () => Navigator.pop(context),
              style: FilledButton.styleFrom(backgroundColor: wildlifeForest),
              child: const Text('Close'),
            ),
          ],
        ),
      );

  Future<void> _logout() async {
    await ApiService.instance.logout();
    if (mounted) {
      Navigator.pushNamedAndRemoveUntil(context, '/login', (_) => false);
    }
  }

  void _message(String value) => ScaffoldMessenger.of(context)
      .showSnackBar(SnackBar(content: Text(value)));
}
