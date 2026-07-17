import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import '../../owner/owner_store.dart';
import '../../services/api_service.dart';
import '../../widgets/owner_layout.dart';

class OwnerSettingsScreen extends StatefulWidget {
  const OwnerSettingsScreen({super.key});
  @override
  State<OwnerSettingsScreen> createState() => _State();
}

class _State extends State<OwnerSettingsScreen> {
  final store = OwnerStore.instance;
  @override
  Widget build(BuildContext context) {
    final s = store.settings;
    return OwnerLayout(
        child: ListView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            children: [
          toggle('App Notifications', 'Receive mobile app notifications',
              s.notifications, (v) => setState(() => s.notifications = v)),
          divider,
          toggle('Auto Updates', 'Automatically update when available',
              s.autoUpdates, (v) => setState(() => s.autoUpdates = v)),
          divider,
          toggle('Privacy', 'Keep profile private', s.privateProfile,
              (v) => setState(() => s.privateProfile = v)),
          divider,
          toggle('Dark Theme', 'Use dark application theme', s.darkTheme,
              (v) => setState(() => s.darkTheme = v)),
          divider,
          action('Password', 'Update your password', changePassword),
          divider,
          action('Language', s.language, language),
          divider,
          action('Need Help?', 'Contact our support center',
              () => message('Support: support@wwms.test')),
          divider,
          action('Log Out', 'Log Out From WWMS', logout, red: true),
          divider,
          action('Delete My Account', 'Delete your WWMS account', deleteAccount,
              red: true)
        ]));
  }

  Widget get divider => const Divider(color: Colors.black12, height: 32);
  Widget toggle(String title, String subtitle, bool value,
          ValueChanged<bool> changed) =>
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title),
          Text(subtitle,
              style: TextStyle(fontSize: 12, color: Colors.grey.shade500))
        ]),
        CupertinoSwitch(value: value, onChanged: changed)
      ]);
  Widget action(String title, String subtitle, VoidCallback tap,
          {bool red = false}) =>
      InkWell(
          onTap: tap,
          child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(title,
                              style: TextStyle(
                                  fontSize: 16,
                                  color: red ? Colors.red : Colors.black87)),
                          Text(subtitle,
                              style: TextStyle(
                                  fontSize: 12, color: Colors.grey.shade500))
                        ]),
                    const Icon(Icons.chevron_right)
                  ])));
  void message(String text) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  void changePassword() {
    final a = TextEditingController(), b = TextEditingController();
    showDialog(
        context: context,
        builder: (d) => AlertDialog(
                title: const Text('Change Password'),
                content: Column(mainAxisSize: MainAxisSize.min, children: [
                  TextField(
                      controller: a,
                      obscureText: true,
                      decoration:
                          const InputDecoration(labelText: 'New password')),
                  TextField(
                      controller: b,
                      obscureText: true,
                      decoration:
                          const InputDecoration(labelText: 'Confirm password'))
                ]),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(d),
                      child: const Text('Cancel')),
                  TextButton(
                      onPressed: () {
                        if (a.text != b.text || !store.changePassword(a.text)) {
                          message(
                              'Passwords must match and contain at least 12 characters.');
                          return;
                        }
                        Navigator.pop(d);
                        message('Password updated locally.');
                      },
                      child: const Text('Update'))
                ]));
  }

  void language() {
    showModalBottomSheet(
        context: context,
        builder: (d) => Column(
            mainAxisSize: MainAxisSize.min,
            children: ['English', 'සිංහල', 'தமிழ்']
                .map((l) => ListTile(
                    title: Text(l),
                    onTap: () {
                      setState(() => store.settings.language = l);
                      Navigator.pop(d);
                    }))
                .toList()));
  }

  Future<void> logout() async {
    await ApiService.instance.logout();
    if (mounted)
      Navigator.pushNamedAndRemoveUntil(context, '/login', (_) => false);
  }

  Future<void> deleteAccount() async {
    final ok = await confirm('Delete account?',
        'This action removes the local owner profile and signs you out.');
    if (ok) {
      store.deleteLocalAccount();
      await logout();
    }
  }

  Future<bool> confirm(String title, String body) async =>
      await showDialog<bool>(
          context: context,
          builder: (d) =>
              AlertDialog(title: Text(title), content: Text(body), actions: [
                TextButton(
                    onPressed: () => Navigator.pop(d, false),
                    child: const Text('Cancel')),
                TextButton(
                    onPressed: () => Navigator.pop(d, true),
                    child: const Text('Confirm'))
              ])) ??
      false;
}
