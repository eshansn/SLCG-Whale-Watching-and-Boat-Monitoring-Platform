import 'dart:ui' as ui;

import 'package:flutter/material.dart';

const ownerNavy = Color(0xFF162D54);
const ownerInk = Color(0xFF14223D);
const ownerCanvas = Color(0xFFF8F9FB);
const ownerMuted = Color(0xFF64748B);

class OwnerDrawer extends StatelessWidget {
  final String active;
  final bool dark;

  const OwnerDrawer({super.key, this.active = 'dashboard', this.dark = false});

  static const _items = [
    ('dashboard', 'Dashboard', Icons.dashboard_outlined, '/boat_owner'),
    ('profile', 'Profile', Icons.person_outline, '/owner_profile'),
    ('crew', 'My Crew', Icons.people_outline, '/owner_my_crew'),
    ('boats', 'My Boats', Icons.directions_boat_outlined, '/owner_boats'),
    ('trips', 'My Trips', Icons.sailing_outlined, '/owner_trips'),
    ('settings', 'Settings', Icons.settings_outlined, '/owner_settings'),
  ];

  @override
  Widget build(BuildContext context) => Drawer(
        width: 310,
        backgroundColor: dark ? Colors.transparent : Colors.white,
        surfaceTintColor: Colors.transparent,
        child: SafeArea(
          child: ClipRect(
            child: BackdropFilter(
              filter: ui.ImageFilter.blur(
                sigmaX: dark ? 20 : 0,
                sigmaY: dark ? 20 : 0,
              ),
              child: ColoredBox(
                color: dark ? const Color(0xC20A1B2E) : Colors.transparent,
                child: Column(
                  children: [
                    Align(
                      alignment: Alignment.centerRight,
                      child: IconButton(
                        tooltip: 'Close menu',
                        color: dark ? Colors.white : ownerInk,
                        icon: const Icon(Icons.close_rounded, size: 28),
                        onPressed: () => Navigator.pop(context),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(24, 18, 24, 22),
                      child: Row(
                        children: [
                          CircleAvatar(
                            backgroundColor:
                                dark ? const Color(0xFF24558B) : ownerNavy,
                            child:
                                const Icon(Icons.sailing, color: Colors.white),
                          ),
                          const SizedBox(width: 12),
                          Text(
                            'Boat Owner',
                            style: TextStyle(
                              fontSize: 19,
                              fontWeight: FontWeight.w700,
                              color: dark ? Colors.white : ownerInk,
                            ),
                          ),
                        ],
                      ),
                    ),
                    ..._items.map((item) {
                      final selected = active == item.$1;
                      return Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: ListTile(
                          selected: selected,
                          iconColor: dark ? const Color(0xFFC8D9EA) : null,
                          textColor: dark ? const Color(0xFFEAF2FB) : null,
                          selectedTileColor: dark
                              ? const Color(0xFF1D4773)
                              : const Color(0xFFF1F5F9),
                          selectedColor: dark ? Colors.white : ownerNavy,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          leading: Icon(item.$3),
                          title: Text(
                            item.$2,
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                          onTap: () {
                            Navigator.pop(context);
                            if (ModalRoute.of(context)?.settings.name !=
                                item.$4) {
                              Navigator.pushReplacementNamed(context, item.$4);
                            }
                          },
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
}

class OwnerLayout extends StatelessWidget {
  final Widget child;
  final String? title;
  final String active;
  final bool darkHeader;

  const OwnerLayout({
    super.key,
    required this.child,
    this.title,
    this.active = 'dashboard',
    this.darkHeader = false,
  });

  @override
  Widget build(BuildContext context) => Scaffold(
        extendBodyBehindAppBar: darkHeader,
        backgroundColor: ownerCanvas,
        appBar: AppBar(
          backgroundColor: darkHeader ? Colors.transparent : Colors.white,
          foregroundColor: darkHeader ? Colors.white : ownerInk,
          surfaceTintColor: Colors.transparent,
          shadowColor: Colors.transparent,
          scrolledUnderElevation: 0,
          flexibleSpace: darkHeader
              ? ClipRect(
                  child: BackdropFilter(
                    filter: ui.ImageFilter.blur(sigmaX: 16, sigmaY: 16),
                    child: Container(
                      decoration: const BoxDecoration(
                        color: Color(0x4D061326),
                        border: Border(
                          bottom: BorderSide(color: Color(0x2EFFFFFF)),
                        ),
                      ),
                    ),
                  ),
                )
              : null,
          elevation: 0,
          leading: IconButton(
            tooltip: 'Dashboard',
            icon: const Icon(Icons.notifications_none_rounded, size: 27),
            onPressed: () {
              if (ModalRoute.of(context)?.settings.name != '/boat_owner') {
                Navigator.pushReplacementNamed(context, '/boat_owner');
              }
            },
          ),
          title: title == null
              ? null
              : Text(
                  title!,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                ),
          actions: [
            Builder(
              builder: (drawerContext) => IconButton(
                tooltip: 'Menu',
                icon: const Icon(Icons.menu_rounded, size: 30),
                onPressed: () => Scaffold.of(drawerContext).openEndDrawer(),
              ),
            ),
          ],
        ),
        endDrawer: OwnerDrawer(active: active, dark: darkHeader),
        body: SafeArea(top: false, child: child),
      );
}
