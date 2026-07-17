import 'package:flutter/material.dart';
import '../../owner/owner_store.dart';

class OwnerMyCrewScreen extends StatefulWidget {
  const OwnerMyCrewScreen({super.key});
  @override
  State<OwnerMyCrewScreen> createState() => _State();
}

class _State extends State<OwnerMyCrewScreen> {
  final store = OwnerStore.instance, search = TextEditingController();
  bool sortByName = true;
  @override
  void initState() {
    super.initState();
    store.addListener(refresh);
  }

  @override
  void dispose() {
    store.removeListener(refresh);
    search.dispose();
    super.dispose();
  }

  void refresh() => setState(() {});
  @override
  Widget build(BuildContext context) {
    final q = search.text.toLowerCase();
    final members = store.crew
        .where((x) =>
            x.name.toLowerCase().contains(q) ||
            x.email.toLowerCase().contains(q))
        .toList()
      ..sort((a, b) =>
          sortByName ? a.name.compareTo(b.name) : a.role.compareTo(b.role));
    return Scaffold(
        backgroundColor: Colors.white,
        appBar: AppBar(
            backgroundColor: Colors.transparent,
            elevation: 0,
            leading: IconButton(
                icon: const Icon(Icons.arrow_back, color: Colors.black),
                onPressed: () => Navigator.pop(context)),
            title: const Text('My crew',
                style: TextStyle(
                    color: Colors.black,
                    fontWeight: FontWeight.bold,
                    fontSize: 18)),
            centerTitle: true),
        body: Column(children: [
          Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Row(children: [
                Expanded(
                    child: TextField(
                        controller: search,
                        onChanged: (_) => setState(() {}),
                        decoration: const InputDecoration(
                            prefixIcon: Icon(Icons.search),
                            hintText: 'Search crew'))),
                IconButton(
                    onPressed: () => setState(() => sortByName = !sortByName),
                    icon: const Icon(Icons.sort))
              ])),
          if (store.invitations.isNotEmpty)
            SizedBox(
                height: 64,
                child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    children: store.invitations
                        .map((invitation) => Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: ActionChip(
                                label: Text(
                                    '${invitation.email} · ${invitation.status.name}'),
                                onPressed: invitation.status ==
                                        InvitationStatus.pending
                                    ? () => store
                                        .acceptInvitation(invitation.email)
                                    : null)))
                        .toList())),
          Expanded(
              child: ListView.separated(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
                  itemCount: members.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, i) => row(members[i]))),
          Padding(
              padding: const EdgeInsets.all(24),
              child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(32),
                  decoration: BoxDecoration(
                      color: const Color(0xFF152238),
                      borderRadius: BorderRadius.circular(16)),
                  child: Column(children: [
                    const Text('Add New Member!',
                        style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: Colors.white)),
                    const SizedBox(height: 8),
                    const Text('Bring someone new on board!',
                        style: TextStyle(color: Colors.white70, fontSize: 13)),
                    const SizedBox(height: 24),
                    SizedBox(
                        width: double.infinity,
                        height: 44,
                        child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.white,
                                foregroundColor: const Color(0xFF152238)),
                            onPressed: invite,
                            child: const Text('Continue',
                                style: TextStyle(fontWeight: FontWeight.bold))))
                  ])))
        ]));
  }

  Widget row(OwnerCrewMember m) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Row(children: [
        Expanded(
            flex: 2,
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(m.name, style: const TextStyle(fontWeight: FontWeight.w500)),
              Text(m.email, style: const TextStyle(fontSize: 11))
            ])),
        Expanded(
            flex: 3,
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(m.role),
              Text(m.certified ? 'Certified' : 'Pending certification',
                  style: TextStyle(
                      fontSize: 11,
                      color: m.certified ? Colors.green : Colors.orange)),
              Text(m.phone, style: const TextStyle(fontSize: 11))
            ])),
        IconButton(
            icon: const Icon(Icons.delete_outline, color: Colors.red, size: 20),
            onPressed: () => remove(m)),
        IconButton(
            icon: const Icon(Icons.info_outline, color: Colors.black, size: 20),
            onPressed: () => details(m))
      ]));
  Future<void> invite() async {
    final c = TextEditingController();
    final email = await showDialog<String>(
        context: context,
        builder: (d) => AlertDialog(
                title: const Text('Invite crew member'),
                content: TextField(
                    controller: c,
                    keyboardType: TextInputType.emailAddress,
                    decoration:
                        const InputDecoration(labelText: 'Crew email address')),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(d),
                      child: const Text('Cancel')),
                  TextButton(
                      onPressed: () => Navigator.pop(d, c.text.trim()),
                      child: const Text('Send invitation'))
                ]));
    if (email == null) return;
    final ok = store.inviteCrew(email);
    if (mounted)
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(ok
              ? 'Invitation sent to $email'
              : 'Enter a registered, certified crew email that has not already been invited.')));
  }

  Future<void> remove(OwnerCrewMember m) async {
    final ok = await showDialog<bool>(
            context: context,
            builder: (d) =>
                AlertDialog(title: Text('Remove ${m.name}?'), actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(d, false),
                      child: const Text('Cancel')),
                  TextButton(
                      onPressed: () => Navigator.pop(d, true),
                      child: const Text('Remove'))
                ])) ??
        false;
    if (ok) store.removeCrew(m.id);
  }

  void details(OwnerCrewMember m) => showDialog(
      context: context,
      builder: (d) => AlertDialog(
              title: Text(m.name),
              content: Text(
                  '${m.email}\n${m.phone}\n${m.role}\n${m.certified ? 'Certified' : 'Certification pending'}'),
              actions: [
                TextButton(
                    onPressed: () => Navigator.pop(d),
                    child: const Text('Close'))
              ]));
}
