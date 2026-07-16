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

void main() {
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
      initialRoute: '/',
      routes: {
        '/': (context) => const WelcomeScreen(),
        '/login': (context) => const LoginScreen(),
        '/signup_step1': (context) => const SignupStep1(),
        
        // Shore Routes
        '/shore_dashboard': (context) => const ShoreDashboard(),
        '/trips_list': (context) => const TripsListScreen(),
        '/vessel_details': (context) => const VesselDetailsScreen(),
        
        // Boat Owner Routes
        '/boat_owner': (context) => const BoatOwnerDashboard(),
        '/owner_profile': (context) => const OwnerProfileScreen(),
        '/owner_boats': (context) => const OwnerBoatsScreen(),
        '/owner_new_boat': (context) => const OwnerNewBoatScreen(),
        '/owner_trips': (context) => const OwnerTripsScreen(),
        '/owner_new_trip': (context) => const OwnerNewTripScreen(),
        '/owner_trip_info': (context) => const OwnerTripInfoScreen(),
        '/owner_my_crew': (context) => const OwnerMyCrewScreen(),
        '/owner_settings': (context) => const OwnerSettingsScreen(),
        '/owner_boat_info': (context) => const OwnerBoatInfoScreen(),
      },
    );
  }
}