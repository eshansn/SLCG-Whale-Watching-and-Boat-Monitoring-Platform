import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../services/api_service.dart';
import '../../widgets/shore_layout.dart';

class ShoreSettingsScreen extends StatefulWidget {
  const ShoreSettingsScreen({super.key});

  @override
  State<ShoreSettingsScreen> createState() => _State();
}

class _State extends State<ShoreSettingsScreen> {
  static const storage = FlutterSecureStorage();
  bool notifications = true;
  bool autoUpdates = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final notificationsValue = await storage.read(key: 'shore_notifications');
    final updatesValue = await storage.read(key: 'shore_auto_updates') ??
        await storage.read(key: 'shore_auto_refresh');
    if (mounted) {
      setState(() {
        notifications = notificationsValue != 'false';
        autoUpdates = updatesValue != 'false';
      });
    }
  }

  Future<void> _save(String key, Object value) =>
      storage.write(key: key, value: value.toString());

  @override
  Widget build(BuildContext context) => ShoreLayout(
        active: 'settings',
        child: LayoutBuilder(
          builder: (context, constraints) => SingleChildScrollView(
            padding: EdgeInsets.symmetric(
              horizontal: constraints.maxWidth >= 900
                  ? 32
                  : constraints.maxWidth >= 600
                      ? 22
                      : 12,
              vertical: constraints.maxWidth >= 600 ? 24 : 14,
            ),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 850),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(32),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x0F0F172A),
                        blurRadius: 30,
                        offset: Offset(0, 8),
                      )
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Settings',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w600,
                          color: shoreInk,
                        ),
                      ),
                      const SizedBox(height: 5),
                      const Text(
                        'Manage Shore Officer application preferences.',
                        style: TextStyle(fontSize: 12, color: shoreMuted),
                      ),
                      const Divider(height: 36, color: Color(0xFFF1F5F9)),
                      _toggle(
                        'App Notifications',
                        'Receive shore trip and approval notifications',
                        notifications,
                        (value) {
                          setState(() => notifications = value);
                          _save('shore_notifications', value);
                        },
                      ),
                      const Divider(height: 36),
                      _toggle(
                        'Auto Updates',
                        'Keep trip records synchronized automatically',
                        autoUpdates,
                        (value) {
                          setState(() => autoUpdates = value);
                          _save('shore_auto_updates', value);
                        },
                      ),
                      const Divider(height: 36),
                      _action(
                        'Refresh Data',
                        'Synchronize trips with the shared database',
                        () async {
                          try {
                            await ApiService.instance.refreshData();
                            _message('Trip data synchronized.');
                          } catch (error) {
                            _message(error.toString());
                          }
                        },
                      ),
                      const Divider(height: 36),
                      _action(
                        'Need Help?',
                        'Contact support@wwms.test',
                        () => _message('Support: support@wwms.test'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      );

  Widget _toggle(
    String title,
    String subtitle,
    bool value,
    ValueChanged<bool> change,
  ) =>
      Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(fontSize: 15, color: shoreInk)),
                const SizedBox(height: 4),
                Text(subtitle,
                    style: const TextStyle(fontSize: 12, color: shoreMuted)),
              ],
            ),
          ),
          CupertinoSwitch(value: value, onChanged: change),
        ],
      );

  Widget _action(String title, String subtitle, VoidCallback tap) => InkWell(
        onTap: tap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: const TextStyle(fontSize: 15, color: shoreInk)),
                    const SizedBox(height: 4),
                    Text(subtitle,
                        style:
                            const TextStyle(fontSize: 12, color: shoreMuted)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: shoreMuted),
            ],
          ),
        ),
      );

  void _message(String text) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
}
