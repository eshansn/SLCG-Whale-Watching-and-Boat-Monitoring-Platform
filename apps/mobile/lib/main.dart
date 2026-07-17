import 'package:flutter/material.dart';

// --- AUTHENTICATION SCREENS ---
import 'screens/auth/welcome_screen.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/signup_step1.dart';

// --- SHORE SCREENS ---
import 'screens/shore/shore_dashboard.dart';
import 'screens/shore/trips_list_screen.dart';
import 'screens/shore/vessel_details_screen.dart';

// --- BOAT OWNER SCREENS ---
import 'screens/owner/boat_owner_dashboard.dart';
import 'screens/owner/owner_profile_screen.dart';
import 'screens/owner/owner_boats_screen.dart';
import 'screens/owner/owner_new_boat_screen.dart';
import 'screens/owner/owner_trips_screen.dart';
import 'screens/owner/owner_new_trip_screen.dart';
import 'screens/owner/owner_trip_info_screen.dart';
import 'screens/owner/owner_my_crew_screen.dart';
import 'screens/owner/owner_settings_screen.dart';
import 'screens/owner/owner_boat_info_screen.dart';
import 'screens/owner/owner_notifications_screen.dart';
import 'screens/crew/boat_crew_dashboard.dart';
import 'screens/passenger/trip_registration_screen.dart';
import 'widgets/auth_gate.dart';
import 'services/api_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ApiService.instance.restore();
  runApp(const WwmsApp());
}

class WwmsApp extends StatelessWidget {
  const WwmsApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'WWMS Platform',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: Colors.black,
      ),
      initialRoute: switch (ApiService.instance.role) {
        'ShoreCrew' => '/shore_dashboard',
        'BoatOwner' => '/boat_owner',
        'BoatCrew' => '/boat_crew',
        _ => '/',
      },
      routes: {
        '/': (context) => const WelcomeScreen(),
        '/login': (context) => const LoginScreen(),
        '/signup_step1': (context) => const SignupStep1(),
        
        // Shore Routes
        '/shore_dashboard': (context) => const AuthGate(roles:['ShoreCrew'],child:ShoreDashboard()),
        '/trips_list': (context) => const AuthGate(roles:['ShoreCrew'],child:TripsListScreen()),
        '/vessel_details': (context) => const AuthGate(roles:['ShoreCrew'],child:VesselDetailsScreen()),
        
        // Boat Owner Routes
        '/boat_owner': (context) => const AuthGate(roles:['BoatOwner'],child:BoatOwnerDashboard()),
        '/owner_profile': (context) => const AuthGate(roles:['BoatOwner'],child:OwnerProfileScreen()),
        '/owner_boats': (context) => const AuthGate(roles:['BoatOwner'],child:OwnerBoatsScreen()),
        '/owner_new_boat': (context) => const AuthGate(roles:['BoatOwner'],child:OwnerNewBoatScreen()),
        '/owner_trips': (context) => const AuthGate(roles:['BoatOwner'],child:OwnerTripsScreen()),
        '/owner_new_trip': (context) => const AuthGate(roles:['BoatOwner'],child:OwnerNewTripScreen()),
        '/owner_trip_info': (context) => const AuthGate(roles:['BoatOwner'],child:OwnerTripInfoScreen()),
        '/owner_my_crew': (context) => const AuthGate(roles:['BoatOwner'],child:OwnerMyCrewScreen()),
        '/owner_settings': (context) => const AuthGate(roles:['BoatOwner'],child:OwnerSettingsScreen()),
        '/owner_boat_info': (context) => const AuthGate(roles:['BoatOwner'],child:OwnerBoatInfoScreen()),
        '/owner_notifications': (context) => const AuthGate(roles:['BoatOwner'],child:OwnerNotificationsScreen()),
        '/boat_crew': (context) => const AuthGate(roles:['BoatCrew'],child:BoatCrewDashboard()),
        '/trip-register': (context) => const TripRegistrationScreen(),
      },
    );
  }
}
