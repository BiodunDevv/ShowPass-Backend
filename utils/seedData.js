require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const UserManager = require("./UserManager");
const Event = require("../models/Event");
const Article = require("../models/Article");
const Booking = require("../models/Booking");
const RefundRequest = require("../models/RefundRequest");
const connectDB = require("../config/database");
const {
  sendWelcomeEmail,
  sendEventCreationNotification,
} = require("./emailService");

const seedData = async () => {
  try {
    // Connect to database
    await connectDB();

    console.log("🌱 Starting database seeding...");

    // Clear existing data
    const Admin = require("../models/Admin");
    const Organizer = require("../models/Organizer");
    const RegularUser = require("../models/RegularUser");

    await Admin.deleteMany({});
    await Organizer.deleteMany({});
    await RegularUser.deleteMany({});
    await Event.deleteMany({});
    await Article.deleteMany({});
    await Booking.deleteMany({});
    await RefundRequest.deleteMany({});
    console.log("🗑️  Cleared existing data");

    // Create Admin User
    const { user: adminUser } = await UserManager.createUser({
      firstName: process.env.ADMIN_FIRST_NAME || "Mustapha",
      lastName: process.env.ADMIN_LAST_NAME || "Muhammed",
      email: process.env.ADMIN_EMAIL || "mustapha.muhammed@bowen.edu.ng",
      password: process.env.ADMIN_PASSWORD || "Balikiss12",
      role: "admin",
      isVerified: true,
    });
    console.log("👑 Admin user created:", adminUser.email);

    // Send welcome email to admin
    try {
      await sendWelcomeEmail(adminUser);
      console.log("📧 Welcome email sent to admin");
    } catch (emailError) {
      console.log("⚠️  Welcome email failed for admin:", emailError.message);
    }

    // Create Organizer User
    const { user: organizerUser } = await UserManager.createUser({
      firstName: "Louis",
      lastName: "Diaz",
      email: process.env.ORGANIZER_EMAIL || "louisdiaz43@gmail.com",
      password: process.env.ORGANIZER_PASSWORD || "Balikiss12",
      role: "organizer",
      phone: "+2348123456789",
      isVerified: true,
    });
    console.log("🎯 Organizer user created:", organizerUser.email);

    // Send welcome email to organizer
    try {
      await sendWelcomeEmail(organizerUser);
      console.log("📧 Welcome email sent to organizer");
    } catch (emailError) {
      console.log(
        "⚠️  Welcome email failed for organizer:",
        emailError.message
      );
    }

    // Create Regular User
    const { user: regularUser } = await UserManager.createUser({
      firstName: "Muhammed",
      lastName: "Abiodun",
      email: process.env.USER_EMAIL || "muhammedabiodun42@gmail.com",
      password: process.env.USER_PASSWORD || "Balikiss12",
      role: "user",
      phone: "+2348087654321",
      isVerified: true,
    });
    console.log("👤 Regular user created:", regularUser.email);

    // Send welcome email to user
    try {
      await sendWelcomeEmail(regularUser);
      console.log("📧 Welcome email sent to user");
    } catch (emailError) {
      console.log("⚠️  Welcome email failed for user:", emailError.message);
    }

    // Send welcome email to user
    try {
      await sendWelcomeEmail(regularUser);
      console.log("📧 Welcome email sent to user");
    } catch (emailError) {
      console.log("⚠️  Welcome email failed for user:", emailError.message);
    }

    // Create sample articles
    const sampleArticles = [
      {
        title: "10 Strategies to Boost Event Attendance in Nigeria",
        slug: "10-strategies-boost-event-attendance-nigeria",
        excerpt:
          "Discover proven methods to increase event attendance and engagement across major Nigerian cities including Lagos, Abuja, and Port Harcourt. Learn from successful event organizers who have consistently sold out their events.",
        content: `<h2>Introduction</h2>
        <p>Organizing successful events in Nigeria requires understanding the local market dynamics, cultural preferences, and effective marketing strategies. With the growing event industry across major cities like Lagos, Abuja, and Port Harcourt, competition for audience attention has intensified.</p>
        
        <h2>1. Leverage Social Media Marketing</h2>
        <p>Nigerian audiences are highly active on social media platforms, particularly Instagram, Twitter, and Facebook. Create engaging content that showcases your event's value proposition.</p>
        <ul>
          <li>Use location-based hashtags (#LagosEvents, #AbujaLife, #PHNightlife)</li>
          <li>Partner with local influencers and content creators</li>
          <li>Share behind-the-scenes content to build excitement</li>
          <li>Create shareable graphics with Afrocentric designs</li>
        </ul>
        
        <h2>2. Partner with Local Communities</h2>
        <p>Nigeria's strong community bonds can be leveraged for event promotion. Partner with:</p>
        <ul>
          <li>Religious organizations</li>
          <li>Professional associations</li>
          <li>Alumni networks</li>
          <li>Local business communities</li>
        </ul>
        
        <h2>3. Optimize Timing and Pricing</h2>
        <p>Understanding Nigerian work patterns and salary cycles is crucial:</p>
        <ul>
          <li>Weekend events typically perform better</li>
          <li>Avoid month-end when people await salaries</li>
          <li>Offer early bird discounts</li>
          <li>Consider group pricing for corporate bookings</li>
        </ul>
        
        <h2>4. Mobile-First Approach</h2>
        <p>With over 90% of Nigerians accessing the internet via mobile devices, ensure your event registration and promotion is mobile-optimized.</p>
        
        <h2>5. Local Payment Methods</h2>
        <p>Integrate popular Nigerian payment methods:</p>
        <ul>
          <li>Bank transfers</li>
          <li>Paystack and Flutterwave</li>
          <li>Mobile money solutions</li>
          <li>Cash payment options through partners</li>
        </ul>
        
        <h2>Conclusion</h2>
        <p>Success in the Nigerian event industry requires a deep understanding of local preferences, strategic use of technology, and building genuine community connections. Focus on providing value and creating memorable experiences that attendees will share with their networks.</p>`,
        image:
          "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800&h=400&fit=crop",
        author: "Adebayo Johnson",
        authorId: adminUser._id,
        category: "Marketing",
        tags: ["marketing", "events", "nigeria", "attendance", "strategies"],
        featured: true,
        status: "published",
        seo: {
          metaTitle:
            "10 Proven Strategies to Boost Event Attendance in Nigeria",
          metaDescription:
            "Learn effective methods to increase event attendance across Nigerian cities. Proven strategies from successful event organizers.",
          keywords: [
            "event marketing",
            "nigeria events",
            "event attendance",
            "lagos events",
          ],
        },
      },
      {
        title: "The Future of Event Technology in Africa",
        slug: "future-event-technology-africa",
        excerpt:
          "Explore how emerging technologies like AI, VR, and blockchain are revolutionizing the event industry across Africa. From virtual reality experiences to AI-powered personalization, discover what's next.",
        content: `<h2>Technology Transformation in African Events</h2>
        <p>The African event industry is experiencing a technological revolution. From Lagos to Cape Town, event organizers are embracing cutting-edge technologies to create more engaging, efficient, and memorable experiences.</p>
        
        <h2>Artificial Intelligence in Event Management</h2>
        <p>AI is transforming how events are planned and executed:</p>
        <ul>
          <li><strong>Personalized Recommendations:</strong> AI algorithms analyze attendee behavior to suggest relevant sessions and networking opportunities</li>
          <li><strong>Chatbots for Customer Service:</strong> 24/7 automated support in local languages</li>
          <li><strong>Predictive Analytics:</strong> Forecasting attendance patterns and optimizing resource allocation</li>
          <li><strong>Smart Scheduling:</strong> AI-powered agenda optimization based on attendee preferences</li>
        </ul>
        
        <h2>Virtual and Augmented Reality Experiences</h2>
        <p>VR and AR are creating immersive event experiences:</p>
        <ul>
          <li>Virtual venue tours for international attendees</li>
          <li>AR-enhanced networking with digital business card exchanges</li>
          <li>Immersive product demonstrations</li>
          <li>Virtual reality training sessions and workshops</li>
        </ul>
        
        <h2>Blockchain for Ticketing and Security</h2>
        <p>Blockchain technology is solving key challenges:</p>
        <ul>
          <li>Fraud-proof ticket authentication</li>
          <li>Transparent and secure payment processing</li>
          <li>Decentralized event credentialing</li>
          <li>Smart contracts for vendor payments</li>
        </ul>
        
        <h2>Mobile-First Solutions</h2>
        <p>Given Africa's mobile-first adoption, event technology focuses on:</p>
        <ul>
          <li>Progressive Web Apps (PWAs) for event management</li>
          <li>Offline-capable mobile applications</li>
          <li>SMS-based registration and updates</li>
          <li>Mobile payment integration</li>
        </ul>
        
        <h2>Internet of Things (IoT) Integration</h2>
        <p>Smart event management through IoT:</p>
        <ul>
          <li>Real-time crowd monitoring and management</li>
          <li>Smart badge tracking for networking optimization</li>
          <li>Environmental monitoring for optimal comfort</li>
          <li>Automated check-in systems</li>
        </ul>
        
        <h2>Sustainability Through Technology</h2>
        <p>Technology is driving sustainable event practices:</p>
        <ul>
          <li>Digital-only materials and programs</li>
          <li>Carbon footprint tracking and offsetting</li>
          <li>Virtual hybrid events reducing travel</li>
          <li>Smart energy management systems</li>
        </ul>
        
        <h2>Challenges and Opportunities</h2>
        <p>While technology offers immense opportunities, African event organizers face challenges:</p>
        <ul>
          <li><strong>Infrastructure:</strong> Inconsistent internet connectivity in some regions</li>
          <li><strong>Digital Literacy:</strong> Varying levels of technical knowledge among attendees</li>
          <li><strong>Cost:</strong> High initial investment in new technologies</li>
          <li><strong>Training:</strong> Need for skilled professionals to implement and manage tech solutions</li>
        </ul>
        
        <h2>The Road Ahead</h2>
        <p>The future of African events will be defined by:</p>
        <ul>
          <li>Increased adoption of hybrid event formats</li>
          <li>AI-powered personalization at scale</li>
          <li>Sustainable technology practices</li>
          <li>Enhanced data analytics and insights</li>
          <li>Cross-continental virtual collaboration</li>
        </ul>
        
        <h2>Conclusion</h2>
        <p>As Africa continues to embrace technological innovation, the event industry stands at the forefront of this transformation. By leveraging these emerging technologies thoughtfully and inclusively, African event organizers can create world-class experiences that rival any global standard while maintaining the continent's unique cultural identity and community spirit.</p>`,
        image:
          "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&h=400&fit=crop",
        author: "Fatima Abdullahi",
        authorId: adminUser._id,
        category: "Technology",
        tags: ["technology", "ai", "blockchain", "vr", "africa", "innovation"],
        featured: true,
        status: "published",
        seo: {
          metaTitle:
            "The Future of Event Technology in Africa - AI, VR & Blockchain",
          metaDescription:
            "Discover how emerging technologies are revolutionizing the African event industry. Learn about AI, VR, and blockchain applications.",
          keywords: [
            "event technology",
            "africa tech",
            "ai events",
            "blockchain ticketing",
          ],
        },
      },
      {
        title: "Building Community Through Local Events",
        slug: "building-community-through-local-events",
        excerpt:
          "Learn how local events are strengthening communities and fostering connections in Nigerian cities and towns. Discover the power of grassroots event organizing and community building.",
        content: `<h2>The Power of Local Community Events</h2>
        <p>In an increasingly digital world, local community events serve as vital touchpoints that bring people together, foster relationships, and strengthen the social fabric of Nigerian communities. From neighbourhood festivals in Lagos to cultural celebrations in rural areas, these gatherings play a crucial role in maintaining our collective identity and sense of belonging.</p>
        
        <h2>Types of Community-Building Events</h2>
        
        <h3>Cultural Celebrations</h3>
        <p>Nigeria's rich cultural diversity provides endless opportunities for community events:</p>
        <ul>
          <li><strong>Traditional Festivals:</strong> New Yam festivals, Durbar celebrations, and masquerade festivals</li>
          <li><strong>Cultural Days:</strong> Celebrating specific ethnic groups within diverse communities</li>
          <li><strong>Food Festivals:</strong> Showcasing local cuisines and cooking traditions</li>
          <li><strong>Music and Dance Events:</strong> Traditional and contemporary performances</li>
        </ul>
        
        <h3>Educational and Skill-Building Events</h3>
        <ul>
          <li>Community workshops on financial literacy</li>
          <li>Digital skills training for youth and elderly</li>
          <li>Health awareness campaigns and medical screenings</li>
          <li>Entrepreneurship training and business plan competitions</li>
        </ul>
        
        <h3>Social Impact Events</h3>
        <ul>
          <li>Environmental cleanup campaigns</li>
          <li>Blood donation drives</li>
          <li>Community garden projects</li>
          <li>Charity fundraisers for local causes</li>
        </ul>
        
        <h2>Benefits of Community Events</h2>
        
        <h3>Social Cohesion</h3>
        <p>Community events break down barriers and create opportunities for:</p>
        <ul>
          <li>Cross-cultural understanding in diverse neighbourhoods</li>
          <li>Intergenerational bonding between youth and elders</li>
          <li>Integration of new residents into established communities</li>
          <li>Strengthening of existing friendships and creation of new ones</li>
        </ul>
        
        <h3>Economic Development</h3>
        <p>Local events contribute to economic growth by:</p>
        <ul>
          <li>Supporting local vendors and small businesses</li>
          <li>Attracting visitors from other areas</li>
          <li>Creating temporary employment opportunities</li>
          <li>Showcasing local products and services</li>
        </ul>
        
        <h3>Cultural Preservation</h3>
        <p>Events help preserve and transmit cultural heritage:</p>
        <ul>
          <li>Teaching traditional practices to younger generations</li>
          <li>Documenting and sharing cultural stories</li>
          <li>Maintaining local languages and dialects</li>
          <li>Preserving traditional crafts and skills</li>
        </ul>
        
        <h2>Best Practices for Community Event Organization</h2>
        
        <h3>Inclusive Planning</h3>
        <ul>
          <li><strong>Community Consultation:</strong> Involve residents in the planning process</li>
          <li><strong>Representative Committees:</strong> Include diverse voices from all demographics</li>
          <li><strong>Accessibility:</strong> Ensure events are accessible to people with disabilities</li>
          <li><strong>Cultural Sensitivity:</strong> Respect religious and cultural differences</li>
        </ul>
        
        <h3>Resource Mobilization</h3>
        <ul>
          <li>Partner with local businesses for sponsorship</li>
          <li>Engage government agencies for support</li>
          <li>Utilize volunteer networks effectively</li>
          <li>Leverage social media for promotion and coordination</li>
        </ul>
        
        <h3>Sustainability</h3>
        <ul>
          <li>Create annual event calendars for predictability</li>
          <li>Build institutional knowledge through documentation</li>
          <li>Train community members in event management</li>
          <li>Establish partnerships with reliable organizations</li>
        </ul>
        
        <h2>Case Studies: Successful Community Events</h2>
        
        <h3>Lagos Community Gardens Festival</h3>
        <p>This annual event in various Lagos communities combines environmental awareness with community bonding. Residents showcase their gardens, share farming techniques, and enjoy locally-grown produce together.</p>
        
        <h3>Abuja Youth Tech Fair</h3>
        <p>A grassroots technology event where young people demonstrate their innovations, learn from each other, and connect with potential mentors and investors from the local business community.</p>
        
        <h3>Port Harcourt Cultural Exchange</h3>
        <p>Monthly events where different ethnic groups take turns hosting cultural exhibitions, creating understanding and appreciation among diverse residents of the oil city.</p>
        
        <h2>Overcoming Common Challenges</h2>
        
        <h3>Limited Resources</h3>
        <ul>
          <li>Start small and grow gradually</li>
          <li>Focus on free or low-cost activities</li>
          <li>Utilize public spaces like schools and community centers</li>
          <li>Encourage potluck-style participation</li>
        </ul>
        
        <h3>Low Participation</h3>
        <ul>
          <li>Conduct door-to-door outreach</li>
          <li>Use local influencers and community leaders</li>
          <li>Offer incentives like prizes or certificates</li>
          <li>Schedule events at convenient times</li>
        </ul>
        
        <h3>Coordination Difficulties</h3>
        <ul>
          <li>Establish clear communication channels</li>
          <li>Use group messaging apps for coordination</li>
          <li>Assign specific roles and responsibilities</li>
          <li>Create backup plans for key activities</li>
        </ul>
        
        <h2>The Role of Technology</h2>
        <p>Modern community events can benefit from technology:</p>
        <ul>
          <li><strong>Social Media:</strong> Facebook groups and WhatsApp for community coordination</li>
          <li><strong>Event Platforms:</strong> Simple registration and information sharing</li>
          <li><strong>Mobile Banking:</strong> Easy collection of contributions and payments</li>
          <li><strong>Digital Documentation:</strong> Capturing and sharing event memories</li>
        </ul>
        
        <h2>Looking Forward</h2>
        <p>The future of community events in Nigeria lies in:</p>
        <ul>
          <li>Hybrid events that combine physical and digital elements</li>
          <li>Greater youth involvement in planning and execution</li>
          <li>Increased focus on sustainability and environmental responsibility</li>
          <li>Better integration with local government development plans</li>
          <li>Enhanced documentation and knowledge sharing between communities</li>
        </ul>
        
        <h2>Conclusion</h2>
        <p>Community events are more than just gatherings; they are the building blocks of strong, resilient societies. In Nigeria, where extended family systems and community bonds remain strong, these events serve as vital mechanisms for preserving culture, fostering development, and creating lasting relationships. By investing in local community events, we invest in the social capital that makes our neighborhoods, cities, and nation stronger.</p>
        
        <p>Whether you're organizing a small street festival or a large cultural celebration, remember that the most successful community events are those that truly reflect the needs, interests, and character of the people they serve. Start where you are, with what you have, and watch as your community grows stronger through the power of shared experiences.</p>`,
        image:
          "https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&h=400&fit=crop",
        author: "Chinedu Okafor",
        authorId: adminUser._id,
        category: "Community",
        tags: [
          "community",
          "local events",
          "culture",
          "nigeria",
          "social impact",
        ],
        featured: true,
        status: "published",
        seo: {
          metaTitle: "Building Community Through Local Events in Nigeria",
          metaDescription:
            "Discover how local events strengthen communities across Nigeria. Learn best practices for organizing successful community gatherings.",
          keywords: [
            "community events",
            "nigeria culture",
            "local organizing",
            "community building",
          ],
        },
      },
      {
        title: "Event Marketing on a Budget: Maximum Impact, Minimum Cost",
        slug: "event-marketing-budget-maximum-impact-minimum-cost",
        excerpt:
          "Discover cost-effective marketing strategies that deliver real results for event organizers working with limited budgets. Learn how to leverage free tools and creative tactics.",
        content: `<h2>Smart Marketing for Resource-Conscious Organizers</h2>
        <p>Not every event has a massive marketing budget, but that doesn't mean you can't achieve impressive attendance numbers and engagement. With creativity, strategic thinking, and the right tools, small-budget events can compete with big-budget productions.</p>
        
        <h2>Free and Low-Cost Marketing Channels</h2>
        
        <h3>Social Media Marketing</h3>
        <ul>
          <li><strong>Organic Content Strategy:</strong> Consistent posting with engaging visuals</li>
          <li><strong>User-Generated Content:</strong> Encourage attendees to share their own content</li>
          <li><strong>Live Streaming:</strong> Behind-the-scenes content and event previews</li>
          <li><strong>Story Features:</strong> Use Instagram and Facebook Stories for regular updates</li>
        </ul>
        
        <h3>Email Marketing</h3>
        <ul>
          <li>Build your own email list from previous events</li>
          <li>Create compelling subject lines that get opened</li>
          <li>Segment your audience for targeted messaging</li>
          <li>Use free tools like Mailchimp or Sendinblue</li>
        </ul>
        
        <h3>Content Marketing</h3>
        <ul>
          <li>Start a blog related to your event theme</li>
          <li>Create valuable resources for your target audience</li>
          <li>Guest post on relevant websites and blogs</li>
          <li>Develop downloadable guides or templates</li>
        </ul>
        
        <h2>Partnership and Collaboration Strategies</h2>
        
        <h3>Cross-Promotion</h3>
        <ul>
          <li>Partner with complementary events</li>
          <li>Exchange marketing mentions with related businesses</li>
          <li>Join forces with other organizers for joint marketing</li>
          <li>Create referral programs with mutual benefits</li>
        </ul>
        
        <h3>Community Partnerships</h3>
        <ul>
          <li>Collaborate with local organizations</li>
          <li>Engage with university and school networks</li>
          <li>Partner with religious and cultural organizations</li>
          <li>Work with professional associations</li>
        </ul>
        
        <h2>Creative Promotional Tactics</h2>
        
        <h3>Guerrilla Marketing</h3>
        <ul>
          <li>Street art and chalk messages (where permitted)</li>
          <li>Flash mobs in busy areas</li>
          <li>Creative flyer distribution</li>
          <li>Pop-up information booths</li>
        </ul>
        
        <h3>Digital Innovation</h3>
        <ul>
          <li>Create shareable memes related to your event</li>
          <li>Develop simple mobile apps or web tools</li>
          <li>Use verification codes for easy information sharing</li>
          <li>Create virtual event previews</li>
        </ul>
        
        <h2>Maximizing Free Tools and Platforms</h2>
        
        <h3>Design Tools</h3>
        <ul>
          <li><strong>Canva:</strong> Professional-looking graphics and posters</li>
          <li><strong>GIMP:</strong> Free alternative to Photoshop</li>
          <li><strong>Unsplash:</strong> High-quality free stock photos</li>
          <li><strong>Google Fonts:</strong> Professional typography</li>
        </ul>
        
        <h3>Analytics and Tracking</h3>
        <ul>
          <li><strong>Google Analytics:</strong> Track website and landing page performance</li>
          <li><strong>Facebook Insights:</strong> Understand your social media audience</li>
          <li><strong>Google Trends:</strong> Identify trending topics and timing</li>
          <li><strong>Bitly:</strong> Track link clicks and sharing</li>
        </ul>
        
        <h2>Building Buzz Without Big Budgets</h2>
        
        <h3>Early Bird Strategies</h3>
        <ul>
          <li>Create exclusive early access for VIP lists</li>
          <li>Offer significant early bird discounts</li>
          <li>Release limited "founder" or "charter member" tickets</li>
          <li>Build anticipation with countdown campaigns</li>
        </ul>
        
        <h3>Social Proof and FOMO</h3>
        <ul>
          <li>Showcase testimonials from previous events</li>
          <li>Display real-time registration numbers</li>
          <li>Highlight notable speakers or attendees</li>
          <li>Create urgency with limited availability messaging</li>
        </ul>
        
        <h2>Leveraging Influencers and Advocates</h2>
        
        <h3>Micro-Influencers</h3>
        <ul>
          <li>Partner with local personalities who have smaller but engaged followings</li>
          <li>Offer free tickets in exchange for promotion</li>
          <li>Create ambassador programs for enthusiastic supporters</li>
          <li>Engage with niche communities relevant to your event</li>
        </ul>
        
        <h3>Employee and Network Advocacy</h3>
        <ul>
          <li>Turn your team into brand ambassadors</li>
          <li>Encourage personal network sharing</li>
          <li>Create easy-to-share content for supporters</li>
          <li>Recognize and reward top promoters</li>
        </ul>
        
        <h2>Public Relations on a Shoestring</h2>
        
        <h3>Media Outreach</h3>
        <ul>
          <li>Write compelling press releases for local media</li>
          <li>Build relationships with relevant journalists</li>
          <li>Offer exclusive interviews or behind-the-scenes access</li>
          <li>Create newsworthy angles and story hooks</li>
        </ul>
        
        <h3>Community Engagement</h3>
        <ul>
          <li>Participate in local forums and online communities</li>
          <li>Sponsor or participate in other community events</li>
          <li>Volunteer at related events to build relationships</li>
          <li>Join professional networks and associations</li>
        </ul>
        
        <h2>Measuring Success Without Expensive Tools</h2>
        
        <h3>Key Metrics to Track</h3>
        <ul>
          <li><strong>Registration conversion rates</strong> from different channels</li>
          <li><strong>Social media engagement</strong> rates and reach</li>
          <li><strong>Email open and click-through rates</strong></li>
          <li><strong>Website traffic</strong> and source attribution</li>
          <li><strong>Word-of-mouth referrals</strong> and organic mentions</li>
        </ul>
        
        <h3>Free Tracking Methods</h3>
        <ul>
          <li>Use unique discount codes for different channels</li>
          <li>Create separate landing pages for different campaigns</li>
          <li>Survey attendees about how they heard about the event</li>
          <li>Monitor social media mentions and hashtags</li>
        </ul>
        
        <h2>Time Management for Solo Marketers</h2>
        
        <h3>Automation Tools</h3>
        <ul>
          <li><strong>Buffer or Hootsuite:</strong> Schedule social media posts</li>
          <li><strong>IFTTT:</strong> Automate cross-platform posting</li>
          <li><strong>Mailchimp:</strong> Automated email sequences</li>
          <li><strong>Calendly:</strong> Automate meeting scheduling</li>
        </ul>
        
        <h3>Content Batching</h3>
        <ul>
          <li>Dedicate specific days to content creation</li>
          <li>Repurpose content across multiple platforms</li>
          <li>Create content templates for consistency</li>
          <li>Plan seasonal and recurring content in advance</li>
        </ul>
        
        <h2>Long-term Brand Building</h2>
        
        <h3>Community Building</h3>
        <ul>
          <li>Maintain engagement between events</li>
          <li>Create exclusive groups for past attendees</li>
          <li>Share valuable content regularly</li>
          <li>Host smaller, informal meetups</li>
        </ul>
        
        <h3>Reputation Management</h3>
        <ul>
          <li>Actively collect and showcase testimonials</li>
          <li>Respond promptly to feedback and concerns</li>
          <li>Document your event success stories</li>
          <li>Build case studies for future marketing</li>
        </ul>
        
        <h2>Common Budget Marketing Mistakes to Avoid</h2>
        
        <ul>
          <li><strong>Spreading too thin:</strong> Focus on 2-3 channels rather than trying everything</li>
          <li><strong>Inconsistent messaging:</strong> Maintain brand voice across all platforms</li>
          <li><strong>Ignoring analytics:</strong> Even free tools provide valuable insights</li>
          <li><strong>Not starting early enough:</strong> Budget marketing requires more lead time</li>
          <li><strong>Forgetting mobile optimization:</strong> Ensure all content works on mobile devices</li>
        </ul>
        
        <h2>Conclusion</h2>
        <p>Successful event marketing isn't about how much money you spend—it's about how creatively and strategically you connect with your audience. By focusing on authentic relationships, valuable content, and consistent execution, budget-conscious event organizers can achieve remarkable results.</p>
        
        <p>Remember that the most powerful marketing tool you have is a great event experience. When attendees have an amazing time, they become your best marketers, sharing their experience with friends and colleagues. Invest your limited resources wisely, measure your results, and always prioritize creating genuine value for your audience.</p>`,
        image:
          "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&h=400&fit=crop",
        author: "Adebayo Johnson",
        authorId: adminUser._id,
        category: "Marketing",
        tags: [
          "marketing",
          "budget",
          "promotion",
          "social media",
          "small business",
        ],
        featured: false,
        status: "published",
        seo: {
          metaTitle:
            "Event Marketing on a Budget - Maximum Impact, Minimum Cost",
          metaDescription:
            "Learn cost-effective marketing strategies for events. Discover free tools and creative tactics that deliver real results.",
          keywords: [
            "budget marketing",
            "event promotion",
            "free marketing tools",
            "small business marketing",
          ],
        },
      },
      {
        title: "Creating Memorable Event Experiences in the Digital Age",
        slug: "creating-memorable-event-experiences-digital-age",
        excerpt:
          "Learn how to blend digital innovation with human connection to create unforgettable event experiences that attendees will remember and share long after the event ends.",
        content: `<h2>The Art of Modern Event Experience Design</h2>
        <p>In today's digital-first world, creating memorable event experiences requires a delicate balance between technological innovation and authentic human connection. The most successful events seamlessly integrate digital tools to enhance, rather than replace, meaningful interactions and lasting memories.</p>
        
        <h2>Understanding the Modern Attendee</h2>
        
        <h3>Digital Natives and Expectations</h3>
        <p>Today's event attendees come with evolved expectations:</p>
        <ul>
          <li><strong>Seamless Technology Integration:</strong> Expect smooth, intuitive digital experiences</li>
          <li><strong>Personalization:</strong> Want content and experiences tailored to their interests</li>
          <li><strong>Social Sharing:</strong> Look for "Instagram-worthy" moments to share</li>
          <li><strong>Multi-device Experience:</strong> Switch between phone, tablet, and laptop seamlessly</li>
          <li><strong>Real-time Information:</strong> Expect instant updates and notifications</li>
        </ul>
        
        <h3>The Human Connection Factor</h3>
        <p>Despite digital preferences, attendees still crave:</p>
        <ul>
          <li>Face-to-face interactions and networking</li>
          <li>Emotional engagement and storytelling</li>
          <li>Shared experiences and community feeling</li>
          <li>Authentic, unscripted moments</li>
          <li>Opportunities for personal growth and learning</li>
        </ul>
        
        <h2>Pre-Event Experience Design</h2>
        
        <h3>Digital Onboarding</h3>
        <ul>
          <li><strong>Personalized Registration:</strong> Tailored questions that inform customization</li>
          <li><strong>Preference Setting:</strong> Allow attendees to customize their experience</li>
          <li><strong>Pre-event Content:</strong> Exclusive materials to build anticipation</li>
          <li><strong>Community Building:</strong> Connect attendees before the event</li>
        </ul>
        
        <h3>Anticipation Building</h3>
        <ul>
          <li>Behind-the-scenes content and sneak peeks</li>
          <li>Interactive polls and surveys</li>
          <li>Countdown campaigns with exclusive releases</li>
          <li>Speaker or performer introductions</li>
          <li>Virtual venue tours and previews</li>
        </ul>
        
        <h2>During-Event Experience Enhancement</h2>
        
        <h3>Digital Tools for Engagement</h3>
        
        <h4>Interactive Event Apps</h4>
        <ul>
          <li><strong>Personalized Agendas:</strong> AI-recommended sessions based on interests</li>
          <li><strong>Real-time Networking:</strong> Smart matchmaking for relevant connections</li>
          <li><strong>Live Polling and Q&A:</strong> Engage audiences during presentations</li>
          <li><strong>Gamification:</strong> Points, badges, and leaderboards for participation</li>
          <li><strong>Social Feeds:</strong> Curated content streams and photo sharing</li>
        </ul>
        
        <h4>Augmented Reality Features</h4>
        <ul>
          <li>Interactive venue maps and wayfinding</li>
          <li>Virtual business card exchanges</li>
          <li>Product demonstrations and visualizations</li>
          <li>Historical or educational overlays</li>
          <li>Photo filters and social media enhancements</li>
        </ul>
        
        <h3>Physical Space Design</h3>
        
        <h4>Instagram-Worthy Moments</h4>
        <ul>
          <li><strong>Photo Opportunities:</strong> Designed spaces specifically for social sharing</li>
          <li><strong>Interactive Installations:</strong> Art pieces or displays that invite participation</li>
          <li><strong>Branded Experiences:</strong> Memorable touchpoints that reinforce event identity</li>
          <li><strong>Lighting Design:</strong> Strategic lighting for both ambiance and photography</li>
        </ul>
        
        <h4>Comfort and Accessibility</h4>
        <ul>
          <li>Charging stations and Wi-Fi optimization</li>
          <li>Quiet zones for introverts and calls</li>
          <li>Accessible design for all abilities</li>
          <li>Clear signage and navigation</li>
          <li>Comfortable seating and gathering areas</li>
        </ul>
        
        <h2>Content and Programming Innovation</h2>
        
        <h3>Interactive Session Formats</h3>
        
        <h4>Beyond Traditional Presentations</h4>
        <ul>
          <li><strong>Workshop Rotations:</strong> Hands-on learning in small groups</li>
          <li><strong>Fishbowl Conversations:</strong> Dynamic, rotating discussion formats</li>
          <li><strong>Lightning Talks:</strong> Quick, impactful presentations</li>
          <li><strong>Panel Discussions:</strong> Multi-perspective conversations</li>
          <li><strong>Peer Learning Circles:</strong> Attendee-led knowledge sharing</li>
        </ul>
        
        <h4>Technology-Enhanced Learning</h4>
        <ul>
          <li>Virtual reality training simulations</li>
          <li>Interactive whiteboards and collaboration tools</li>
          <li>Real-time translation services</li>
          <li>Live streaming to remote participants</li>
          <li>AI-powered session recommendations</li>
        </ul>
        
        <h3>Storytelling and Emotional Design</h3>
        
        <h4>Narrative Architecture</h4>
        <ul>
          <li><strong>Event Journey Mapping:</strong> Design the attendee experience as a story</li>
          <li><strong>Emotional Peaks and Valleys:</strong> Plan high-energy and reflection moments</li>
          <li><strong>Character Development:</strong> Feature real people and their stories</li>
          <li><strong>Conflict and Resolution:</strong> Address challenges and provide solutions</li>
          <li><strong>Memorable Conclusions:</strong> End with clear takeaways and inspiration</li>
        </ul>
        
        <h4>Multi-Sensory Experiences</h4>
        <ul>
          <li>Signature scents that trigger memory</li>
          <li>Curated soundtracks for different event zones</li>
          <li>Textural elements in displays and installations</li>
          <li>Taste experiences that complement the theme</li>
          <li>Visual design that supports the narrative</li>
        </ul>
        
        <h2>Networking and Community Building</h2>
        
        <h3>Structured Networking</h3>
        
        <h4>Smart Matchmaking</h4>
        <ul>
          <li><strong>Algorithm-Based Matching:</strong> Connect attendees with shared interests</li>
          <li><strong>Goal-Oriented Connections:</strong> Match based on specific objectives</li>
          <li><strong>Industry or Role-Based Groups:</strong> Targeted networking sessions</li>
          <li><strong>Mentor-Mentee Matching:</strong> Connect experienced with emerging professionals</li>
        </ul>
        
        <h4>Facilitated Interactions</h4>
        <ul>
          <li>Speed networking with structured rotations</li>
          <li>Icebreaker activities and conversation starters</li>
          <li>Group challenges and collaborative projects</li>
          <li>Shared meal experiences with strategic seating</li>
          <li>Walking meetings and activity-based networking</li>
        </ul>
        
        <h3>Digital Community Extension</h3>
        
        <h4>Virtual Networking Spaces</h4>
        <ul>
          <li>Online forums and discussion groups</li>
          <li>Video networking lounges</li>
          <li>Collaborative workspaces and documents</li>
          <li>Virtual coffee chats and meetups</li>
          <li>Professional social networks and alumni groups</li>
        </ul>
        
        <h2>Post-Event Experience Continuation</h2>
        
        <h3>Immediate Follow-up</h3>
        <ul>
          <li><strong>Same-Day Highlights:</strong> Share photos and key moments</li>
          <li><strong>Connection Facilitation:</strong> Help attendees reconnect with new contacts</li>
          <li><strong>Resource Sharing:</strong> Provide presentations, recordings, and materials</li>
          <li><strong>Feedback Collection:</strong> Gather insights while experience is fresh</li>
          <li><strong>Thank You Messages:</strong> Personalized appreciation for attendance</li>
        </ul>
        
        <h3>Long-term Engagement</h3>
        <ul>
          <li>Monthly newsletters with valuable content</li>
          <li>Alumni networks and ongoing communities</li>
          <li>Follow-up events and reunions</li>
          <li>Online learning platforms and resources</li>
          <li>Mentorship programs and continued connections</li>
        </ul>
        
        <h2>Measuring Experience Quality</h2>
        
        <h3>Quantitative Metrics</h3>
        <ul>
          <li><strong>Net Promoter Score (NPS):</strong> Likelihood to recommend</li>
          <li><strong>Engagement Rates:</strong> App usage, session attendance, interaction levels</li>
          <li><strong>Social Media Mentions:</strong> Organic sharing and discussion</li>
          <li><strong>Return Attendance:</strong> Repeat participation in future events</li>
          <li><strong>Connection Success:</strong> Meaningful relationships formed</li>
        </ul>
        
        <h3>Qualitative Assessment</h3>
        <ul>
          <li>Detailed feedback surveys and interviews</li>
          <li>Focus groups with diverse attendees</li>
          <li>Social media sentiment analysis</li>
          <li>Story collection and testimonials</li>
          <li>Long-term impact assessment</li>
        </ul>
        
        <h2>Technology Integration Best Practices</h2>
        
        <h3>Seamless Implementation</h3>
        <ul>
          <li><strong>User-Friendly Design:</strong> Intuitive interfaces that require minimal learning</li>
          <li><strong>Backup Plans:</strong> Always have non-digital alternatives</li>
          <li><strong>Staff Training:</strong> Ensure team can support and troubleshoot</li>
          <li><strong>Testing and QA:</strong> Thoroughly test all technology before event day</li>
          <li><strong>Support Systems:</strong> Provide help desk and technical assistance</li>
        </ul>
        
        <h3>Privacy and Security</h3>
        <ul>
          <li>Transparent data collection policies</li>
          <li>Secure networking and payment systems</li>
          <li>Opt-in sharing and communication preferences</li>
          <li>GDPR compliance and data protection</li>
          <li>Clear boundaries on information use</li>
        </ul>
        
        <h2>Cultural Considerations</h2>
        
        <h3>Local Context and Sensitivity</h3>
        <ul>
          <li><strong>Cultural Norms:</strong> Respect local customs and traditions</li>
          <li><strong>Language Considerations:</strong> Provide appropriate translations and interpretations</li>
          <li><strong>Religious Observances:</strong> Schedule around important cultural dates</li>
          <li><strong>Dietary Requirements:</strong> Accommodate diverse food preferences and restrictions</li>
          <li><strong>Communication Styles:</strong> Adapt to local preferences for interaction</li>
        </ul>
        
        <h3>Inclusive Design</h3>
        <ul>
          <li>Accessibility for various physical abilities</li>
          <li>Economic accessibility through varied pricing</li>
          <li>Technology accessibility for different skill levels</li>
          <li>Content accessibility in multiple formats</li>
          <li>Social accessibility for different personality types</li>
        </ul>
        
        <h2>Future Trends in Event Experience</h2>
        
        <h3>Emerging Technologies</h3>
        <ul>
          <li><strong>Artificial Intelligence:</strong> Hyper-personalized experiences and recommendations</li>
          <li><strong>Virtual and Mixed Reality:</strong> Immersive experiences and remote participation</li>
          <li><strong>Internet of Things:</strong> Smart badges and environmental responsiveness</li>
          <li><strong>Blockchain:</strong> Secure credentialing and micropayments</li>
          <li><strong>5G Connectivity:</strong> Enhanced real-time interactions and data sharing</li>
        </ul>
        
        <h3>Evolving Expectations</h3>
        <ul>
          <li>Increased demand for sustainability and environmental responsibility</li>
          <li>Greater emphasis on mental health and well-being</li>
          <li>Expectation for meaningful social impact</li>
          <li>Desire for authentic, unfiltered experiences</li>
          <li>Need for flexible, adaptive event formats</li>
        </ul>
        
        <h2>Conclusion</h2>
        <p>Creating memorable event experiences in the digital age requires thoughtful integration of technology with human-centered design. The most successful events use digital tools to amplify authentic connections, facilitate meaningful learning, and create lasting impact.</p>
        
        <p>Remember that technology should serve the experience, not dominate it. Focus on understanding your attendees' needs, desires, and goals, then design experiences that use both digital and physical elements to exceed their expectations. The events that attendees remember and talk about years later are those that made them feel valued, connected, and inspired.</p>
        
        <p>As the event industry continues to evolve, stay curious about new technologies and methodologies, but never lose sight of the fundamental human need for connection, learning, and shared experiences. The future belongs to event organizers who can masterfully blend digital innovation with authentic human moments.</p>`,
        image:
          "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=400&fit=crop",
        author: "Fatima Abdullahi",
        authorId: adminUser._id,
        category: "Technology",
        tags: [
          "experience design",
          "digital events",
          "technology",
          "engagement",
          "innovation",
        ],
        featured: false,
        status: "published",
        seo: {
          metaTitle: "Creating Memorable Event Experiences in the Digital Age",
          metaDescription:
            "Learn to blend digital innovation with human connection for unforgettable events. Modern experience design strategies.",
          keywords: [
            "event experience",
            "digital events",
            "experience design",
            "event technology",
          ],
        },
      },
    ];

    // Create articles
    console.log("📝 Creating sample articles...");
    const createdArticles = await Article.insertMany(sampleArticles);
    console.log(`✅ Created ${createdArticles.length} articles`);

    console.log(`
✅ Database seeding completed successfully!

📊 Summary:
- Total users created: ${
      (await UserManager.getAllAdmins()).length +
      (await UserManager.getAllOrganizers()).length +
      (await UserManager.getAllRegularUsers()).length
    }
  - Admins: ${(await UserManager.getAllAdmins()).length}
  - Organizers: ${(await UserManager.getAllOrganizers()).length}
  - Regular Users: ${(await UserManager.getAllRegularUsers()).length}
- Events created: ${await Event.countDocuments()}
- Articles created: ${await Article.countDocuments()}

🔐 Default Login Credentials:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👑 Admin:
   Email: ${adminUser.email}
   Password: ${process.env.ADMIN_PASSWORD || "Balikiss12"}

🎯 Organizer:
   Email: ${organizerUser.email}
   Password: ${process.env.ORGANIZER_PASSWORD || "Balikiss12"}

👤 User:
   Email: ${regularUser.email}
   Password: ${process.env.USER_PASSWORD || "Balikiss12"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
};

// Run seeding if this file is executed directly
if (require.main === module) {
  seedData();
}

module.exports = seedData;
