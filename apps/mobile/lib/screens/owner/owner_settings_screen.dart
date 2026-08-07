import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../widgets/owner_layout.dart';
import 'owner_portal_common.dart';

class OwnerSettingsScreen extends StatefulWidget {
  const OwnerSettingsScreen({super.key});

  @override
  State<OwnerSettingsScreen> createState() => _OwnerSettingsScreenState();
}

class _OwnerSettingsScreenState extends State<OwnerSettingsScreen> {
  bool _notifications = true;
  bool _autoUpdates = true;

  @override
  Widget build(BuildContext context) => OwnerLayout(
        active: 'settings',
        title: 'Settings',
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 40),
          children: [
            const Text('Settings',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            const Text('Manage your Boat Owner portal preferences.',
                style: TextStyle(color: ownerMuted)),
            const SizedBox(height: 20),
            OwnerCard(
              child: Column(
                children: [
                  _toggle(
                    'App Notifications',
                    'Receive mobile app notifications',
                    _notifications,
                    (value) => setState(() => _notifications = value),
                  ),
                  const Divider(height: 30),
                  _toggle(
                    'Auto Updates',
                    'Automatically update when available',
                    _autoUpdates,
                    (value) => setState(() => _autoUpdates = value),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            OwnerCard(
              child: Column(
                children: [
                  _action('Password', 'Update your password',
                      Icons.lock_outline_rounded, _changePassword),
                  const Divider(height: 30),
                  _action('Need Help?', 'Open the help section',
                      Icons.help_outline_rounded, () {}),
                  const Divider(height: 30),
                  _action('Log Out', 'Log Out From WWMS', Icons.logout_rounded,
                      _logout,
                      destructive: true),
                ],
              ),
            ),
          ],
        ),
      );

  Widget _toggle(String title, String subtitle, bool value,
          ValueChanged<bool> onChanged) =>
      Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                Text(subtitle,
                    style: const TextStyle(color: ownerMuted, fontSize: 12)),
              ],
            ),
          ),
          CupertinoSwitch(value: value, onChanged: onChanged),
        ],
      );

  Widget _action(String title, String subtitle, IconData icon, VoidCallback tap,
          {bool destructive = false}) =>
      InkWell(
        onTap: tap,
        child: Row(
          children: [
            Icon(icon, color: destructive ? Colors.red : ownerNavy),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: destructive ? Colors.red : ownerInk)),
                  Text(subtitle,
                      style: const TextStyle(color: ownerMuted, fontSize: 12)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded),
          ],
        ),
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
                  error = ownerError(exception);
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
                  Text(error!, style: const TextStyle(color: Colors.red)),
                ],
              ],
            ),
            actions: [
              TextButton(
                  onPressed: saving ? null : () => Navigator.pop(context),
                  child: const Text('Cancel')),
              FilledButton(
                  onPressed: saving ? null : submit,
                  child: Text(saving ? 'Updating…' : 'Update')),
            ],
          );
        },
      ),
    );
    current.dispose();
    password.dispose();
    confirm.dispose();
  }

  void _message(String value) => ScaffoldMessenger.of(context)
      .showSnackBar(SnackBar(content: Text(value)));

  Future<void> _logout() async {
    await ApiService.instance.logout();
    if (mounted) {
      Navigator.pushNamedAndRemoveUntil(context, '/login', (_) => false);
    }
  }
}
